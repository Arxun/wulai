"""
不依赖任何 AI 模型的“浮雕补背面”后端。

思路：照片里的人物 = 遮罩 + 深度图。把它做成一个封闭的“充气”实体：
  - 正面：由遮罩内每个像素的“到轮廓距离”撑出圆润的体积（sqrt 剖面，轮廓处切线垂直 → 圆滑），
          再叠加深度图的细节起伏；
  - 背面：与正面对称地鼓出去，并根据正面颜色“推测”背面颜色
          （头 → 后脑勺发色；躯干 / 袖子 → 外套颜色；裤腿 → 保留）；
  - 轮廓处正反两面汇合，网格封闭。

这是启发式的，背面只是合理猜测，真实度远不如 TripoSR 之类的模型；
但不需要下载任何权重，能保证“可以 360° 旋转”。

坐标：x 向右，y 向上，z 朝向观察者；单位：照片宽度 = 1。
"""
from __future__ import annotations

import colorsys

import numpy as np
from scipy import ndimage as ndi

from . import MeshResult


def _bilinear(img: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """在 [H, W, C] 图上按像素坐标双线性采样。"""
    h, w = img.shape[:2]
    x = np.clip(x, 0, w - 1)
    y = np.clip(y, 0, h - 1)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    x1, y1 = np.minimum(x0 + 1, w - 1), np.minimum(y0 + 1, h - 1)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    return (
        img[y0, x0] * (1 - fx) * (1 - fy)
        + img[y0, x1] * fx * (1 - fy)
        + img[y1, x0] * (1 - fx) * fy
        + img[y1, x1] * fx * fy
    )


def _hsv(img: np.ndarray) -> np.ndarray:
    """向量化 RGB→HSV（0~1）。"""
    mx, mn = img.max(-1), img.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    nz = d > 1e-6
    h[nz & (mx == r)] = (((g - b)[nz & (mx == r)] / d[nz & (mx == r)]) % 6) / 6
    h[nz & (mx == g)] = (((b - r)[nz & (mx == g)] / d[nz & (mx == g)]) + 2) / 6
    h[nz & (mx == b)] = (((r - g)[nz & (mx == b)] / d[nz & (mx == b)]) + 4) / 6
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return np.stack([h, s, mx], -1)


def synthesize_back_image(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """
    由正面照片推测背面颜色图（与正面同坐标，不镜像）。
    规则见模块注释；颜色统计全部取自照片本身，不写死颜色。
    """
    h, w = mask.shape
    ys, xs = np.where(mask)
    y0, y1 = ys.min(), ys.max()
    bh = y1 - y0
    hsv = _hsv(image)
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    def frac(y):  # 把行号换成 “人物包围盒内的高度比例”（0 = 头顶，1 = 脚底）
        return (y - y0) / max(bh, 1)

    rows = np.arange(h)[:, None] * np.ones((1, w))
    f = frac(rows)

    # ---- 统计关键颜色 ----
    red = mask & ((hue < 0.06) | (hue > 0.94)) & (sat > 0.45) & (val > 0.3)
    if red.sum() > 50:
        # 只在较亮的那一半红色像素里取中位数：避免把褶皱阴影的暗红当成外套本色
        reds = image[red]
        bright = reds[reds.max(-1) >= np.median(reds.max(-1))]
        jacket = np.median(bright, axis=0)
    else:
        jacket = np.array([0.7, 0.25, 0.18])

    head = mask & (f < 0.17)
    dark_head = head & (val < 0.28)
    hair = np.median(image[dark_head], axis=0) if dark_head.sum() > 30 else np.array([0.08, 0.07, 0.06])

    skin_like = mask & (hue > 0.02) & (hue < 0.12) & (sat > 0.18) & (sat < 0.6) & (val > 0.5)
    skin = np.median(image[head & skin_like], axis=0) if (head & skin_like).sum() > 30 else np.array([0.85, 0.68, 0.58])

    # 外套下摆：红色像素最靠下的行（取 98 分位，抗噪）
    hem_f = float(np.percentile(f[red], 98)) if red.sum() > 50 else 0.62

    # ---- 逐像素重画背面 ----
    blurred = np.stack([ndi.gaussian_filter(image[..., c], 4) for c in range(3)], -1)
    back = blurred.copy()

    # 头部：后脑勺发色，下巴以下到脖子用肤色
    head_zone = mask & (f < 0.20)
    nape = f > 0.145
    back[head_zone & ~nape] = hair
    back[head_zone & nape] = skin * 0.92

    # 躯干 + 袖子：除了红色外套本身、手（肤色）和深色背包，其余（衬衫 / T 恤 / 内衬）一律画成外套色
    torso = mask & (f >= 0.20) & (f < hem_f)
    keep = red | (skin_like & (f > 0.30)) | (val < 0.2)
    repaint = torso & ~keep
    # 外套色叠一点低频明暗，避免一整块死色
    lum = ndi.gaussian_filter(val, 12)
    shade = 0.88 + 0.24 * (lum - lum[mask].mean()) / max(lum[mask].std(), 1e-3) * 0.25
    back[repaint] = np.clip(jacket[None, :] * shade[repaint][:, None], 0, 1)
    # 已经是红色的地方也统一成外套色（正面有拉链 / 口袋阴影，背面没有）
    back[torso & red] = np.clip(0.5 * back[torso & red] + 0.5 * (jacket[None, :] * shade[torso & red][:, None]), 0, 1)

    # 下摆以下（T 恤边、裤子、靴子）保留正面模糊色
    return np.clip(back, 0, 1)


def generate(
    image: np.ndarray,
    mask: np.ndarray,
    depth: np.ndarray,
    step: int = 2,
    inflate: float = 0.40,
    relief: float = 0.12,
    **_ignored,
) -> MeshResult:
    """
    image: [H, W, 3] float 0~1； mask: bool [H, W]； depth: [H, W] float 0~1（亮 = 近）
    step:   网格间距（像素），越小越细
    inflate: 充气强度（越大越“胖”）
    relief:  深度图细节的起伏幅度
    """
    H, W = mask.shape
    aspect = H / W

    dist = ndi.distance_transform_edt(mask)  # 到轮廓的像素距离
    dist_n = dist / W  # 换成“照片宽度 = 1”的单位

    # 深度细节：只保留相对主体的起伏，轻度平滑
    dsm = ndi.gaussian_filter(depth, 2.0)
    d_ref = float(np.median(dsm[mask]))
    d_detail = (dsm - d_ref) * relief

    # 半厚度：sqrt 剖面（轮廓处陡、中间平缓）
    half = inflate * np.sqrt(np.maximum(dist_n, 0.0))

    # 网格：只保留四个角都在遮罩里的格子
    gy, gx = np.mgrid[0:H:step, 0:W:step]
    gh, gw = gy.shape
    inside = mask[gy, gx]
    quad_ok = inside[:-1, :-1] & inside[:-1, 1:] & inside[1:, :-1] & inside[1:, 1:]

    idx_map = -np.ones((gh, gw), dtype=np.int64)
    used = np.zeros((gh, gw), dtype=bool)
    qi, qj = np.where(quad_ok)
    for di, dj in ((0, 0), (0, 1), (1, 0), (1, 1)):
        used[qi + di, qj + dj] = True
    idx_map[used] = np.arange(used.sum())
    n = int(used.sum())

    px = gx[used].astype(np.float64)
    py = gy[used].astype(np.float64)
    hh = _bilinear(half[..., None], px, py)[:, 0]
    dd = _bilinear(d_detail[..., None], px, py)[:, 0]

    # 世界坐标
    X = px / W - 0.5
    Y = (H - 1 - py) / W - aspect / 2  # 向上
    z_front = hh + dd
    z_back = -hh - dd * 0.3  # 背面细节更弱
    # 轮廓处不要让正反面交叉
    z_front = np.maximum(z_front, 0.004)
    z_back = np.minimum(z_back, -0.004)

    v_front = np.stack([X, Y, z_front], 1)
    v_back = np.stack([X, Y, z_back], 1)
    vertices = np.concatenate([v_front, v_back], 0)

    # 面：每个格子两个三角形
    a = idx_map[qi, qj]
    b = idx_map[qi, qj + 1]
    c = idx_map[qi + 1, qj]
    d = idx_map[qi + 1, qj + 1]
    # 屏幕坐标里 row 向下；Y 向上，所以 (a,c,b) 是从 +Z 看去的逆时针
    f_front = np.concatenate([np.stack([a, c, b], 1), np.stack([b, c, d], 1)], 0)
    f_back = f_front[:, ::-1] + n  # 反向绕序

    # 轮廓缝合：找正面三角形里只出现一次的边，补一圈连接正反面的四边形
    edges = np.concatenate([f_front[:, [0, 1]], f_front[:, [1, 2]], f_front[:, [2, 0]]], 0)
    key = np.sort(edges, 1)
    _, inv, counts = np.unique(key, axis=0, return_inverse=True, return_counts=True)
    boundary = edges[counts[inv] == 1]
    p, q = boundary[:, 0], boundary[:, 1]
    f_side = np.concatenate([np.stack([p, q, q + n], 1), np.stack([p, q + n, p + n], 1)], 0)
    faces = np.concatenate([f_front, f_back, f_side], 0)

    # 颜色：正面取照片，背面取推测的背面图
    col_front = _bilinear(image, px, py)
    back_img = synthesize_back_image(image, mask)
    col_back = _bilinear(back_img, px, py)
    colors = np.concatenate([col_front, col_back], 0)

    return MeshResult(
        vertices=vertices,
        faces=faces,
        colors=colors,
        info={"backend": "relief", "step": step, "inflate": inflate, "relief": relief},
        oriented=True,
    )
