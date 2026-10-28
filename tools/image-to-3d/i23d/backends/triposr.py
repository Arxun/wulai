"""
TripoSR 后端（单张图 → 完整 3D 网格，背面由模型补全）。

官方实现 https://github.com/VAST-AI-Research/TripoSR 放在 ../TripoSR，这里不改它的源码，
而是在运行时打 3 个补丁，让它在“受限网络 / 没有编译环境”的机器上也能跑：
  1. torchmcubes（需要编译）→ 用 scikit-image 的 marching_cubes 代替；
  2. rembg / imageio（只在它的工具函数里 import，我们不用）→ 放空桩；
  3. DINO ViT 的配置默认要去 HuggingFace 下载 config.json → 改成本地构造同样的 ViTConfig
     （DINO 权重本身包含在 TripoSR 的 model.ckpt 里）。

需要的权重：把官方的 model.ckpt（可选 config.yaml）放进 ../weights/。
"""
from __future__ import annotations

import sys
import time
import types
from pathlib import Path

import numpy as np

from . import MeshResult
from ..imaging import prepare_triposr_input
from ..mathutil import signed_volume

HERE = Path(__file__).resolve().parent
TOOL_ROOT = HERE.parent.parent  # tools/image-to-3d
TRIPOSR_SRC = TOOL_ROOT / "TripoSR"
DEFAULT_CONFIG = HERE.parent / "configs" / "triposr.yaml"


# --------------------------------------------------------------------------- patches
def _install_stub_modules() -> None:
    """补丁 1、2：在 import tsr 之前塞入替身模块。"""
    import torch
    from skimage import measure

    if "torchmcubes" not in sys.modules:
        mod = types.ModuleType("torchmcubes")

        def marching_cubes(vol: "torch.Tensor", thresh: float):
            """
            与 torchmcubes.marching_cubes 同签名：vol[x, y, z]、等值面 thresh。
            torchmcubes 返回的顶点坐标顺序是 (z, y, x)（TripoSR 随后会用 [2,1,0] 翻回来），
            skimage 返回 (x, y, z)，所以这里反转一次以保持一致。
            """
            arr = vol.detach().cpu().numpy().astype(np.float32)
            verts, faces, _, _ = measure.marching_cubes(arr, level=float(thresh))
            verts = np.ascontiguousarray(verts[:, ::-1])
            return torch.from_numpy(verts.copy()).float(), torch.from_numpy(faces.astype(np.int64).copy())

        mod.marching_cubes = marching_cubes
        sys.modules["torchmcubes"] = mod

    for name in ("rembg", "imageio"):
        if name not in sys.modules:
            try:
                __import__(name)
            except Exception:  # noqa: BLE001
                sys.modules[name] = types.ModuleType(name)


def _patch_dino_tokenizer() -> None:
    """补丁 3：本地构造 dino-vitb16 的 ViTConfig，避免访问 HuggingFace。"""
    from transformers import ViTConfig
    from transformers.models.vit.modeling_vit import ViTModel

    from tsr.models.tokenizers import image as image_mod

    def configure(self) -> None:  # noqa: ANN001
        import torch

        cfg = ViTConfig(
            hidden_size=768,
            num_hidden_layers=12,
            num_attention_heads=12,
            intermediate_size=3072,
            hidden_act="gelu",
            image_size=224,
            patch_size=16,
            num_channels=3,
            qkv_bias=True,
            layer_norm_eps=1e-12,
        )
        self.model = ViTModel(cfg)
        if self.cfg.enable_gradient_checkpointing:
            self.model.encoder.gradient_checkpointing = True
        self.register_buffer(
            "image_mean", torch.as_tensor([0.485, 0.456, 0.406]).reshape(1, 1, 3, 1, 1), persistent=False
        )
        self.register_buffer(
            "image_std", torch.as_tensor([0.229, 0.224, 0.225]).reshape(1, 1, 3, 1, 1), persistent=False
        )

    image_mod.DINOSingleImageTokenizer.configure = configure


# --------------------------------------------------------------------------- model
def load_model(weights_dir: str | Path, device: str = "cpu", chunk_size: int = 8192, allow_random_init: bool = False):
    """
    加载 TripoSR。
    allow_random_init=True 时，没有权重也会用随机初始化构造（只用于测试代码路径，输出是噪声）。
    """
    import torch
    from omegaconf import OmegaConf

    if not TRIPOSR_SRC.exists():
        raise FileNotFoundError(f"找不到 TripoSR 源码目录 {TRIPOSR_SRC}")
    _install_stub_modules()
    if str(TRIPOSR_SRC) not in sys.path:
        sys.path.insert(0, str(TRIPOSR_SRC))
    _patch_dino_tokenizer()

    from tsr.system import TSR

    weights_dir = Path(weights_dir)
    cfg_path = weights_dir / "config.yaml"
    if not cfg_path.exists():
        cfg_path = DEFAULT_CONFIG
    ckpt_path = weights_dir / "model.ckpt"

    cfg = OmegaConf.load(cfg_path)
    OmegaConf.resolve(cfg)
    model = TSR(cfg)

    if ckpt_path.exists():
        state = torch.load(str(ckpt_path), map_location="cpu")
        missing, unexpected = model.load_state_dict(state, strict=False)
        if missing:
            print(f"[triposr] 警告：{len(missing)} 个参数没有在权重里找到（例如 {missing[:3]}）")
        if unexpected:
            print(f"[triposr] 提示：权重里有 {len(unexpected)} 个多余参数（例如 {unexpected[:3]}）")
    elif allow_random_init:
        print("[triposr] 没有找到 model.ckpt，使用随机初始化（输出无意义，仅测试流程）")
    else:
        raise FileNotFoundError(
            f"没有找到权重 {ckpt_path}。\n"
            "请从 ModelScope（stabilityai/TripoSR）或 HuggingFace（stabilityai/TripoSR）下载 model.ckpt，"
            f"放到 {weights_dir}/"
        )

    model.renderer.set_chunk_size(chunk_size)
    model.to(device)
    model.eval()
    return model


# --------------------------------------------------------------------------- generate
def generate(
    image: np.ndarray,
    mask: np.ndarray,
    weights_dir: str | Path,
    device: str = "cpu",
    mc_resolution: int = 256,
    chunk_size: int = 8192,
    threshold: float = 25.0,
    debug_dir: str | None = None,
    allow_random_init: bool = False,
    **_ignored,
) -> MeshResult:
    """image: [H,W,3] 0~1；mask: bool [H,W]。返回的网格朝向由 TripoSR 决定，之后由 orientation 模块统一。"""
    import torch
    import trimesh

    t0 = time.time()
    pil_in, crop = prepare_triposr_input(image, mask)
    if debug_dir:
        Path(debug_dir).mkdir(parents=True, exist_ok=True)
        pil_in.save(Path(debug_dir) / "triposr_input.png")
    print(f"[triposr] 输入已预处理 {pil_in.size}（前景占比 0.85，灰底）")

    model = load_model(weights_dir, device=device, chunk_size=chunk_size, allow_random_init=allow_random_init)
    print(f"[triposr] 模型就绪 ({time.time() - t0:.1f}s)，device={device}")

    with torch.no_grad():
        codes = model([pil_in], device=device)
        print(f"[triposr] triplane 编码完成 ({time.time() - t0:.1f}s)，开始提取网格 res={mc_resolution}")
        meshes = model.extract_mesh(codes, True, resolution=mc_resolution, threshold=threshold)
    mesh: trimesh.Trimesh = meshes[0]

    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    vc = np.asarray(mesh.visual.vertex_colors, dtype=np.float32)[:, :3]
    colors = vc / 255.0 if vc.max() > 1.5 else vc

    # 保证面朝外（符号体积为正），否则翻转绕序
    if signed_volume(vertices, faces) < 0:
        faces = faces[:, ::-1].copy()

    return MeshResult(
        vertices=vertices,
        faces=faces,
        colors=colors,
        info={
            "backend": "triposr",
            "mcResolution": mc_resolution,
            "threshold": threshold,
            "elapsedSec": round(time.time() - t0, 1),
        },
        oriented=False,
    )
