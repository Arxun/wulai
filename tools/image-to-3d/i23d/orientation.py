"""
朝向与投影对齐。

问题：不同的单图转 3D 模型输出的网格，“哪个轴朝上、哪面朝前”的约定不一样，
而且我们还想把原照片精确地投影回网格正面。

做法：
  1. 在 24 种“轴置换 + 翻转”（旋转群）里，挑一个让网格轮廓与照片里的人物遮罩最像的。
  2. 用正交相机 + 仿射（缩放 / 平移）做细化，最大化轮廓 IoU。
  3. 输出：把网格旋成 “+Y 向上、+Z 朝前”，以及一个 4x4 的 “模型空间 → 照片裁剪空间” 矩阵。
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass

import numpy as np

from .mathutil import apply_rotation


def rotation_group_24() -> list[np.ndarray]:
    """24 个行列式为 +1 的 3x3 轴置换 / 翻转矩阵（立方体旋转群）。"""
    mats = []
    for perm in itertools.permutations(range(3)):
        for signs in itertools.product([1, -1], repeat=3):
            m = np.zeros((3, 3))
            for r, (c, s) in enumerate(zip(perm, signs)):
                m[r, c] = s
            if np.linalg.det(m) > 0:
                mats.append(m)
    return mats


def _splat_silhouette(xy: np.ndarray, bounds: tuple[float, float, float, float], size: tuple[int, int]) -> np.ndarray:
    """把 2D 点（顶点）栅格化成 size=(H, W) 的轮廓，再做一次闭运算填缝。"""
    from scipy import ndimage as ndi

    h, w = size
    x0, y0, x1, y1 = bounds
    u = ((xy[:, 0] - x0) / max(x1 - x0, 1e-9) * (w - 1)).round().astype(int)
    v = ((xy[:, 1] - y0) / max(y1 - y0, 1e-9) * (h - 1)).round().astype(int)
    ok = (u >= 0) & (u < w) & (v >= 0) & (v < h)
    img = np.zeros((h, w), dtype=bool)
    img[v[ok], u[ok]] = True
    return ndi.binary_closing(img, iterations=3)


def _iou(a: np.ndarray, b: np.ndarray) -> float:
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(inter) / float(max(union, 1))


@dataclass
class Alignment:
    """对齐结果。"""

    rotation: np.ndarray  # 3x3：原始网格坐标 → “+Y 向上 / +Z 朝前”的新坐标
    # 正交投影：新坐标 (x, y, z) → 照片归一化坐标 u = ax*x + bx, v = ay*y + by（0~1，v 向上）
    ax: float
    bx: float
    ay: float
    by: float
    z_near: float  # 新坐标下模型 z 的最小值（离拍摄相机最远的一侧：朝前 = +Z，z 越大越靠近相机）
    z_far: float  # 新坐标下模型 z 的最大值（离拍摄相机最近的一侧）
    iou: float

    def projection_matrix(self) -> np.ndarray:
        """
        4x4 行主序：新坐标齐次点 → 裁剪空间（正交相机，从 +Z 方向看）。
        NDC x,y ∈ [-1,1] 对应整张照片；NDC z：最靠近相机（z = z_far）→ -1，最远（z = z_near）→ +1。
        前后各留 2% 余量，避免边界点被裁掉 / 深度比较时贴着边。
        """
        m = np.eye(4)
        m[0, 0], m[0, 3] = 2 * self.ax, 2 * self.bx - 1
        m[1, 1], m[1, 3] = 2 * self.ay, 2 * self.by - 1
        span = max(self.z_far - self.z_near, 1e-9) * 1.04
        z_max = self.z_far + 0.02 * (self.z_far - self.z_near)
        m[2, 2] = -2.0 / span
        m[2, 3] = 2.0 * z_max / span - 1.0
        return m


def align_mesh_to_mask(
    vertices: np.ndarray,
    mask: np.ndarray,
    candidates: list[np.ndarray] | None = None,
    sil_size: tuple[int, int] = (256, 144),
) -> Alignment:
    """
    把网格顶点对齐到照片里的人物遮罩。
    mask: bool [H, W]，H > W（竖图）。
    """
    from PIL import Image

    H, W = mask.shape
    # 目标轮廓：缩到 sil_size，作为比较基准
    target = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize((sil_size[1], sil_size[0]), Image.BILINEAR)) > 127
    ys, xs = np.where(target)
    tb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)  # 目标包围盒（像素）

    best = None
    for rot in candidates or rotation_group_24():
        v = apply_rotation(vertices, rot)
        # 约定：+Y 向上，所以屏幕 x = v[:,0]，屏幕 y = v[:,1]
        xy = v[:, :2]
        x0, y0 = xy.min(0)
        x1, y1 = xy.max(0)
        # 先用包围盒贴合（保持长宽比不变，居中）作为初值
        sx = (tb[2] - tb[0]) / max(x1 - x0, 1e-9)
        sy = (tb[3] - tb[1]) / max(y1 - y0, 1e-9)
        s = min(sx, sy)
        cx_t, cy_t = (tb[0] + tb[2]) / 2, (tb[1] + tb[3]) / 2
        cx_m, cy_m = (x0 + x1) / 2, (y0 + y1) / 2
        # 像素坐标：u 向右，row 向下 → 用 -y 映射
        u = (xy[:, 0] - cx_m) * s + cx_t
        r = cy_t - (xy[:, 1] - cy_m) * s
        sil = np.zeros(sil_size, dtype=bool)
        ui, ri = u.round().astype(int), r.round().astype(int)
        ok = (ui >= 0) & (ui < sil_size[1]) & (ri >= 0) & (ri < sil_size[0])
        sil[ri[ok], ui[ok]] = True
        from scipy import ndimage as ndi

        sil = ndi.binary_closing(sil, iterations=3)
        score = _iou(sil, target)
        if best is None or score > best[0]:
            best = (score, rot, (s, cx_m, cy_m, cx_t, cy_t))

    score, rot, (s, cx_m, cy_m, cx_t, cy_t) = best
    v = apply_rotation(vertices, rot)

    # 把像素坐标换算成 0~1 的照片归一化坐标。u 向右；v 向上 = 1 - row/H
    ax = s / sil_size[1]
    bx = (cx_t - cx_m * s) / sil_size[1]
    ay = s / sil_size[0]
    by = 1.0 - (cy_t + cy_m * s) / sil_size[0]

    # 细化：在 (ax,bx,ay,by) 附近做坐标下降，最大化 IoU（只做几步，足够）
    def render(params):
        ax_, bx_, ay_, by_ = params
        u = (v[:, 0] * ax_ + bx_) * (sil_size[1] - 1)
        r = (1.0 - (v[:, 1] * ay_ + by_)) * (sil_size[0] - 1)
        sil = np.zeros(sil_size, dtype=bool)
        ui, ri = u.round().astype(int), r.round().astype(int)
        ok = (ui >= 0) & (ui < sil_size[1]) & (ri >= 0) & (ri < sil_size[0])
        sil[ri[ok], ui[ok]] = True
        from scipy import ndimage as ndi

        return ndi.binary_closing(sil, iterations=3)

    params = np.array([ax, bx, ay, by], dtype=np.float64)
    cur = _iou(render(params), target)
    steps = np.array([0.01, 0.004, 0.01, 0.004])
    for _ in range(40):
        improved = False
        for i in range(4):
            for sgn in (-1, 1):
                trial = params.copy()
                trial[i] += sgn * steps[i] * (abs(params[i]) + 0.05)
                sc = _iou(render(trial), target)
                if sc > cur + 1e-5:
                    params, cur, improved = trial, sc, True
        if not improved:
            steps *= 0.5
            if steps.max() < 1e-4:
                break

    return Alignment(
        rotation=rot,
        ax=float(params[0]),
        bx=float(params[1]),
        ay=float(params[2]),
        by=float(params[3]),
        z_near=float(v[:, 2].min()),
        z_far=float(v[:, 2].max()),
        iou=float(cur),
    )
