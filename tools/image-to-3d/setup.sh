#!/usr/bin/env bash
# 安装 Python 依赖。需要 Python 3.10+（推荐 3.11）。
# 默认建 venv；如果你的环境不方便建 venv，可以 TARGET=pylib ./setup.sh 装到本地 pylib 目录。
set -euo pipefail
cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3.11}"
INDEX="${PIP_INDEX_URL:-https://pypi.org/simple}"
PKGS="torch numpy pillow scipy scikit-image trimesh omegaconf einops transformers safetensors huggingface_hub imageio"

if [ "${TARGET:-venv}" = "pylib" ]; then
  "$PYTHON" -m pip install --no-cache-dir --target pylib --index-url "$INDEX" $PKGS
else
  "$PYTHON" -m venv venv
  venv/bin/python -m pip install --upgrade pip
  venv/bin/python -m pip install --index-url "$INDEX" $PKGS
fi
echo "完成。运行 ./run.sh generate --help 查看用法"
