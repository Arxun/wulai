"""图像相关的通用工具：读图、清理遮罩、裁剪 + 灰底合成（TripoSR 输入格式）。"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def load_rgb(path: str) -> np.ndarray:
    """读 RGB 图，返回 float32 [H, W, 3]，范围 0~1。"""
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255.0


def load_gray(path: str) -> np.ndarray:
    """读灰度图，返回 float32 [H, W]，范围 0~1。"""
    return np.asarray(Image.open(path).convert("L"), dtype=np.float32) / 255.0


def clean_mask(mask: np.ndarray, threshold: float = 0.5, open_radius: int = 2) -> np.ndarray:
    """
    清理二值遮罩：阈值化 → 开运算去毛刺 → 只保留最大连通域 → 填洞。
    返回 bool [H, W]。
    """
    m = mask > threshold
    if open_radius > 0:
        st = ndi.generate_binary_structure(2, 1)
        m = ndi.binary_opening(m, structure=st, iterations=open_radius)
    labels, n = ndi.label(m)
    if n > 1:
        sizes = ndi.sum(m, labels, index=range(1, n + 1))
        m = labels == (int(np.argmax(sizes)) + 1)
    return ndi.binary_fill_holes(m)


def mask_bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    """遮罩的包围盒 (x0, y0, x1, y1)，x1/y1 为开区间。"""
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


@dataclass
class CropInfo:
    """记录“从原图裁出一块正方形再缩放”的变换，用于把模型坐标映射回原图像素。"""

    x0: float  # 正方形左上角（原图像素）
    y0: float
    side: float  # 正方形边长（原图像素）
    out_size: int  # 输出图像边长


def prepare_triposr_input(
    image: np.ndarray, mask: np.ndarray, foreground_ratio: float = 0.85, out_size: int = 512
) -> tuple[Image.Image, CropInfo]:
    """
    复刻 TripoSR 的预处理：抠出前景 → 居中放进正方形（前景占 foreground_ratio）
    → 缩放到 out_size → 背景填 0.5 灰。
    同时返回裁剪变换，后面对齐投影要用。
    """
    x0, y0, x1, y1 = mask_bbox(mask)
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    side = max(w, h) / foreground_ratio
    sx0, sy0 = cx - side / 2.0, cy - side / 2.0

    # 用仿射变换一次性完成裁剪 + 缩放（越界区域填灰）
    scale = out_size / side
    rgb = Image.fromarray((image * 255).astype(np.uint8))
    a = Image.fromarray((mask * 255).astype(np.uint8))
    coeffs = (1 / scale, 0, sx0, 0, 1 / scale, sy0)
    rgb_c = rgb.transform((out_size, out_size), Image.AFFINE, coeffs, resample=Image.BICUBIC, fillcolor=(128, 128, 128))
    a_c = a.transform((out_size, out_size), Image.AFFINE, coeffs, resample=Image.BILINEAR, fillcolor=0)

    rgb_f = np.asarray(rgb_c, dtype=np.float32) / 255.0
    a_f = np.asarray(a_c, dtype=np.float32)[..., None] / 255.0
    comp = rgb_f * a_f + (1.0 - a_f) * 0.5
    out = Image.fromarray((comp * 255).astype(np.uint8))
    return out, CropInfo(x0=sx0, y0=sy0, side=side, out_size=out_size)
