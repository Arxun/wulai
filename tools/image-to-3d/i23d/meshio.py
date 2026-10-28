"""网格导出：GLB（顶点色，手写，不依赖 trimesh）+ 描述朝向 / 投影的 JSON。"""
from __future__ import annotations

import json
import struct
from pathlib import Path

import numpy as np

from .mathutil import vertex_normals
from .orientation import Alignment


def _pad4(b: bytes, pad: bytes = b"\x00") -> bytes:
    return b + pad * ((4 - len(b) % 4) % 4)


def export_glb(vertices: np.ndarray, faces: np.ndarray, colors_rgb01: np.ndarray, path: str) -> None:
    """
    导出带顶点色 + 法线的 GLB。
    colors_rgb01: [N, 3]，0~1，**按显示用的 sRGB 值**（查看器的着色器原样输出，不做色彩空间转换）。
    """
    pos = np.ascontiguousarray(vertices, dtype=np.float32)
    nrm = np.ascontiguousarray(vertex_normals(vertices.astype(np.float64), faces), dtype=np.float32)
    col = np.ascontiguousarray(np.clip(colors_rgb01, 0, 1), dtype=np.float32)
    idx = np.ascontiguousarray(faces, dtype=np.uint32).reshape(-1)

    blobs = [idx.tobytes(), pos.tobytes(), nrm.tobytes(), col.tobytes()]
    offsets, cursor = [], 0
    for b in blobs:
        offsets.append(cursor)
        cursor += len(_pad4(b))
    binary = b"".join(_pad4(b) for b in blobs)

    n = len(pos)
    gltf = {
        "asset": {"version": "2.0", "generator": "i23d"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "person"}],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": 1, "NORMAL": 2, "COLOR_0": 3},
                        "indices": 0,
                        "material": 0,
                        "mode": 4,
                    }
                ]
            }
        ],
        "materials": [{"pbrMetallicRoughness": {"metallicFactor": 0.0, "roughnessFactor": 1.0}, "doubleSided": True}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(blobs[0]), "target": 34963},
            {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(blobs[1]), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(blobs[2]), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[3], "byteLength": len(blobs[3]), "target": 34962},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5125, "count": len(idx), "type": "SCALAR"},
            {
                "bufferView": 1,
                "componentType": 5126,
                "count": n,
                "type": "VEC3",
                "min": [float(x) for x in pos.min(0)],
                "max": [float(x) for x in pos.max(0)],
            },
            {"bufferView": 2, "componentType": 5126, "count": n, "type": "VEC3"},
            {"bufferView": 3, "componentType": 5126, "count": n, "type": "VEC3"},
        ],
    }
    js = _pad4(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    total = 12 + 8 + len(js) + 8 + len(binary)
    out = struct.pack("<4sII", b"glTF", 2, total)
    out += struct.pack("<I4s", len(js), b"JSON") + js
    out += struct.pack("<I4s", len(binary), b"BIN\x00") + binary

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_bytes(out)


def write_meta(
    path: str,
    *,
    generator: str,
    photo_url: str,
    alignment: Alignment,
    vertices: np.ndarray,
    extra: dict | None = None,
) -> None:
    """
    写 meta JSON，供前端把照片投影回网格：
      projMatrix: 列主序 16 个数（模型空间 → 照片相机裁剪空间）
      frontDir:   模型空间里“朝向拍摄相机”的方向（对齐后恒为 +Z）
    """
    m = alignment.projection_matrix()
    meta = {
        "generator": generator,
        "photo": photo_url,
        "frontDir": [0.0, 0.0, 1.0],
        "projMatrix": [float(x) for x in m.T.flatten()],  # 行主序转列主序
        "alignmentIoU": round(alignment.iou, 4),
        "bounds": {
            "min": [float(x) for x in vertices.min(0)],
            "max": [float(x) for x in vertices.max(0)],
        },
        "vertexCount": int(len(vertices)),
    }
    if extra:
        meta.update(extra)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(meta, ensure_ascii=False, indent=2))
