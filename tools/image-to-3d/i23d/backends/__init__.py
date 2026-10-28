"""
生成后端的统一约定：

    result = backend.generate(image, mask, **opts)  ->  MeshResult

MeshResult.vertices 的朝向可以是任意约定（后面 orientation.align_mesh_to_mask 会统一成 +Y 向上、+Z 朝前）。
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class MeshResult:
    vertices: np.ndarray  # [N, 3] float
    faces: np.ndarray  # [M, 3] int
    colors: np.ndarray  # [N, 3] float 0~1（sRGB 显示值）
    info: dict = field(default_factory=dict)
    # True 表示网格已经是“+Y 向上、+Z 朝前”，不需要再搜索朝向（浮雕后端）
    oriented: bool = False
