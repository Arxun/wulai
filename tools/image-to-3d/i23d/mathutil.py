"""
不走 BLAS 的小型数学工具。

为什么要自己写：部分 macOS + numpy(Accelerate) 组合下，大数组上的 np.dot / matmul 会直接段错误。
这些函数只用逐元素运算和 add.at，慢一点点但在任何环境都稳。
"""
from __future__ import annotations

import numpy as np


def apply_rotation(v: np.ndarray, rot: np.ndarray) -> np.ndarray:
    """v: [N,3]，rot: [3,3]；等价于 v @ rot.T。"""
    out = np.empty_like(v, dtype=np.float64)
    for i in range(3):
        out[:, i] = v[:, 0] * rot[i, 0] + v[:, 1] * rot[i, 1] + v[:, 2] * rot[i, 2]
    return out


def normalize_rows(v: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    n = np.sqrt(v[:, 0] ** 2 + v[:, 1] ** 2 + v[:, 2] ** 2)
    return v / np.maximum(n, eps)[:, None]


def vertex_normals(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """面积加权的顶点法线。"""
    v0, v1, v2 = vertices[faces[:, 0]], vertices[faces[:, 1]], vertices[faces[:, 2]]
    e1, e2 = v1 - v0, v2 - v0
    fn = np.stack(
        [
            e1[:, 1] * e2[:, 2] - e1[:, 2] * e2[:, 1],
            e1[:, 2] * e2[:, 0] - e1[:, 0] * e2[:, 2],
            e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0],
        ],
        1,
    )  # 模长 = 2 * 面积，天然面积加权
    out = np.zeros_like(vertices, dtype=np.float64)
    for k in range(3):
        np.add.at(out, faces[:, k], fn)
    return normalize_rows(out)


def signed_volume(vertices: np.ndarray, faces: np.ndarray) -> float:
    """网格有符号体积；为正说明面朝外（逆时针绕序）。"""
    v0, v1, v2 = vertices[faces[:, 0]], vertices[faces[:, 1]], vertices[faces[:, 2]]
    cross = np.stack(
        [
            v1[:, 1] * v2[:, 2] - v1[:, 2] * v2[:, 1],
            v1[:, 2] * v2[:, 0] - v1[:, 0] * v2[:, 2],
            v1[:, 0] * v2[:, 1] - v1[:, 1] * v2[:, 0],
        ],
        1,
    )
    return float((v0[:, 0] * cross[:, 0] + v0[:, 1] * cross[:, 1] + v0[:, 2] * cross[:, 2]).sum() / 6.0)
