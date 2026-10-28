"""命令行入口：python -m i23d generate ..."""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np

from . import imaging
from .meshio import export_glb, write_meta
from .mathutil import apply_rotation
from .orientation import Alignment, align_mesh_to_mask


def _relief_alignment(vertices: np.ndarray, aspect: float) -> Alignment:
    """浮雕后端的网格天生就是“照片坐标”：x ∈ [-0.5,0.5]，y ∈ [-aspect/2, aspect/2]，解析给出投影。"""
    return Alignment(
        rotation=np.eye(3),
        ax=1.0,
        bx=0.5,
        ay=1.0 / aspect,
        by=0.5,
        z_near=float(vertices[:, 2].min()),
        z_far=float(vertices[:, 2].max()),
        iou=1.0,
    )


def cmd_generate(args: argparse.Namespace) -> int:
    t0 = time.time()
    image = imaging.load_rgb(args.image)
    mask = imaging.clean_mask(imaging.load_gray(args.mask))
    H, W = mask.shape
    print(f"[i23d] image {W}x{H}, mask pixels {int(mask.sum())}")

    if args.backend == "relief":
        from .backends import relief

        depth = imaging.load_gray(args.depth)
        if depth.shape != mask.shape:
            from PIL import Image

            depth = np.asarray(
                Image.fromarray((depth * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), dtype=np.float32
            ) / 255.0
        result = relief.generate(image, mask, depth, step=args.step)
    elif args.backend == "triposr":
        from .backends import triposr

        result = triposr.generate(
            image,
            mask,
            weights_dir=args.weights,
            device=args.device,
            mc_resolution=args.resolution,
            chunk_size=args.chunk,
            debug_dir=args.debug_dir,
        )
    else:  # pragma: no cover
        raise SystemExit(f"未知后端 {args.backend}")

    vertices, faces, colors = result.vertices, result.faces, result.colors
    print(f"[i23d] backend={args.backend}: {len(vertices)} verts, {len(faces)} faces ({time.time() - t0:.1f}s)")

    if result.oriented:
        alignment = _relief_alignment(vertices, H / W)
    else:
        alignment = align_mesh_to_mask(vertices, mask)
        vertices = apply_rotation(vertices, alignment.rotation)
        print(f"[i23d] 朝向对齐 IoU={alignment.iou:.3f}")
        if alignment.iou < 0.6:
            print("[i23d] 警告：轮廓重合度偏低，投影贴图可能错位，请检查输入遮罩或模型输出", file=sys.stderr)

    out_dir = Path(args.out_dir)
    glb = out_dir / f"{args.name}.glb"
    meta = out_dir / f"{args.name}.json"
    export_glb(vertices, faces, colors, str(glb))
    write_meta(
        str(meta),
        generator=args.backend,
        photo_url=args.photo_url,
        alignment=alignment,
        vertices=vertices,
        extra=result.info,
    )
    print(f"[i23d] 已写出 {glb} ({glb.stat().st_size / 1e6:.1f} MB) 和 {meta}")

    if args.preview_dir:
        from .preview import render_turntable

        out = render_turntable(vertices, faces, colors, args.preview_dir, name=f"{args.name}-turntable")
        print(f"[i23d] 预览图 {out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="i23d", description="照片 → 可 360° 旋转的 3D 模型")
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("generate", help="生成 GLB + meta")
    g.add_argument("--backend", choices=["relief", "triposr"], default="relief")
    g.add_argument("--image", required=True, help="原照片")
    g.add_argument("--mask", required=True, help="人物遮罩（白 = 人物）")
    g.add_argument("--depth", help="深度图（亮 = 近），relief 后端需要")
    g.add_argument("--out-dir", required=True)
    g.add_argument("--name", default="person")
    g.add_argument("--photo-url", default="/reference.jpg", help="前端里加载照片的 URL（写进 meta）")
    # relief
    g.add_argument("--step", type=int, default=2, help="relief：网格间距（像素）")
    # triposr
    g.add_argument("--weights", default=str(Path(__file__).resolve().parent.parent / "weights"))
    g.add_argument("--device", default="cpu", choices=["cpu", "mps", "cuda"])
    g.add_argument("--resolution", type=int, default=256, help="triposr：Marching Cubes 分辨率")
    g.add_argument("--chunk", type=int, default=8192, help="triposr：每批查询点数（内存不够就调小）")
    g.add_argument("--debug-dir", help="保存中间结果（预处理后的输入图等）")
    g.add_argument("--preview-dir", help="用软件光栅化渲染多角度联系图到该目录（无需 GPU / 浏览器）")
    g.set_defaults(func=cmd_generate)

    args = p.parse_args(argv)
    if args.backend == "relief" and not args.depth:
        p.error("relief 后端需要 --depth")
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
