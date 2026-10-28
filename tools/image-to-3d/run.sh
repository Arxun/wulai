#!/usr/bin/env bash
# 运行 i23d CLI。优先用 venv，没有则用本地 pylib（PYTHONPATH 方式）。
# 用法：./run.sh generate --backend relief --image ... --mask ... --depth ... --out-dir ...
set -euo pipefail
cd "$(dirname "$0")"

if [ -x venv/bin/python ]; then
  PY=venv/bin/python
elif [ -d pylib ]; then
  PY="${PYTHON:-python3.11}"
  export PYTHONPATH="$PWD/pylib:${PYTHONPATH:-}"
else
  echo "还没有安装依赖，请先运行 ./setup.sh" >&2
  exit 1
fi

exec "$PY" -m i23d "$@"
