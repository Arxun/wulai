"""
纯 numpy + PIL 的软件光栅化预览（画家算法）。
不依赖 GPU / 浏览器，用来在无头环境里快速检查网格形状、朝向和顶点色。
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from .mathutil import apply_rotation, normalize_rows


def _rot_y(deg: float) -> np.ndarray:
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def render_view(
    vertices: np.ndarray,
    faces: np.ndarray,
    colors: np.ndarray,
    yaw_deg: float = 0.0,
    size: tuple[int, int] = (512, 768),
    bg=(222, 229, 233),
    supersample: int = 2,
) -> Image.Image:
    """正交投影渲染；yaw_deg 绕 +Y 轴旋转模型（0 = 正面，180 = 背面）。"""
    W, H = size
    W2, H2 = W * supersample, H * supersample

    v = apply_rotation(vertices, _rot_y(yaw_deg))
    mn, mx = v.min(0), v.max(0)
    # 用整体包围球的竖直尺寸定比例，使不同角度大小一致
    height = max(vertices[:, 1].max() - vertices[:, 1].min(), 1e-9)
    scale = 0.9 * H2 / height
    cx = 0.5 * (mn[0] + mx[0])
    cy = 0.5 * (vertices[:, 1].min() + vertices[:, 1].max())
    sx = (v[:, 0] - cx) * scale + W2 / 2
    sy = H2 / 2 - (v[:, 1] - cy) * scale
    z = v[:, 2]

    f = faces
    p0, p1, p2 = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    e1, e2 = p1 - p0, p2 - p0
    n = np.stack(
        [
            e1[:, 1] * e2[:, 2] - e1[:, 2] * e2[:, 1],
            e1[:, 2] * e2[:, 0] - e1[:, 0] * e2[:, 2],
            e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0],
        ],
        1,
    )
    n = normalize_rows(n)
    facing = n[:, 2]  # 面朝向相机（+Z）为正
    # 双面：背对相机的面也画（法线翻转），保证封闭网格从内部也不透
    lam = np.abs(facing)
    light = np.array([-0.25, 0.4, 0.85])
    light = light / np.linalg.norm(light)
    lam2 = np.clip(np.abs(n[:, 0] * light[0] + n[:, 1] * light[1] + n[:, 2] * light[2]), 0, 1)
    shade = 0.78 + 0.28 * lam2

    fc = (colors[f[:, 0]] + colors[f[:, 1]] + colors[f[:, 2]]) / 3.0
    fc = np.clip(fc * shade[:, None], 0, 1)
    fc8 = (fc * 255).astype(np.uint8)

    # 只画朝向相机的面，再按深度从远到近
    vis = facing > 0
    order = np.argsort(z[f[vis]].mean(1))
    idx = np.where(vis)[0][order]

    img = Image.new("RGB", (W2, H2), bg)
    d = ImageDraw.Draw(img)
    for i in idx:
        a, b, c = f[i]
        d.polygon(
            [(sx[a], sy[a]), (sx[b], sy[b]), (sx[c], sy[c])],
            fill=(int(fc8[i, 0]), int(fc8[i, 1]), int(fc8[i, 2])),
        )
    return img.resize((W, H), Image.LANCZOS)


def render_turntable(
    vertices: np.ndarray, faces: np.ndarray, colors: np.ndarray, out_dir: str, name: str = "preview",
    yaws=(0, 90, 180, 270, 45, 135),
) -> Path:
    """渲染多个角度并拼成一张联系图，返回路径。"""
    tiles = [render_view(vertices, faces, colors, y) for y in yaws]
    w, h = tiles[0].size
    cols = 3
    rows = math.ceil(len(tiles) / cols)
    sheet = Image.new("RGB", (cols * w, rows * h))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * w, (i // cols) * h))
    out = Path(out_dir) / f"{name}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    return out
