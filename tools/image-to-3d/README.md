# image-to-3d：照片 → 可 360° 旋转的 3D 模型

把一张人物照片变成带顶点色的 GLB（背面由 AI / 启发式补全），并输出一份 `meta.json`，
前端据此把**原照片以投影贴图的方式贴回模型正面**（正面保持照片的清晰度，侧面 / 背面用补全颜色）。

```
照片 + 人物遮罩 (+ 深度图)
        │
        ▼
 ┌────────────────┐      ┌────────────────────────────┐
 │ backend=relief │  或  │ backend=triposr            │
 │ 无需模型，启发式 │      │ TripoSR 单图转 3D（需权重） │
 └───────┬────────┘      └─────────────┬──────────────┘
         └────────────┬────────────────┘
                      ▼
          朝向对齐（24 种旋转 + 仿射细化，最大化轮廓 IoU）
                      ▼
      public/models/person.glb  +  person.json（投影矩阵等）
```

## 目录

```
i23d/
  cli.py            命令行入口
  imaging.py        读图 / 遮罩清理 / TripoSR 输入预处理
  orientation.py    朝向与投影对齐（把模型统一成 +Y 向上、+Z 朝前，并给出投影矩阵）
  mathutil.py       不走 BLAS 的小数学工具（部分 macOS 上大数组 np.dot 会段错误）
  meshio.py         GLB（手写，无需 trimesh）与 meta.json 导出
  preview.py        纯 numpy 的软件光栅化预览（无 GPU / 浏览器也能看）
  backends/
    relief.py       无模型的“充气浮雕 + 推测背面颜色”
    triposr.py      TripoSR 后端（运行时打补丁，免编译 / 免访问 HuggingFace）
  configs/triposr.yaml   官方模型结构配置（weights/ 里有官方 config.yaml 时优先用官方）
TripoSR/            官方源码（只读，未修改）
weights/            放 model.ckpt（见下）
```

## 安装

```bash
cd tools/image-to-3d
./setup.sh                 # 建 venv 并安装依赖（需要 Python 3.10+，推荐 3.11）
# 不方便建 venv 时： TARGET=pylib ./setup.sh
```

## 用法

先准备好输入（在项目根目录）：`public/reference.jpg`（照片）、`public/photo3d/person-mask.png`（人物遮罩）、
`public/photo3d/depth.png`（深度图）。它们由 `tools/photo3d/` 里的脚本生成。

### 1) 不需要任何模型（保底，立刻可用）

```bash
./run.sh generate --backend relief \
  --image ../../public/reference.jpg \
  --mask  ../../public/photo3d/person-mask.png \
  --depth ../../public/photo3d/depth.png \
  --out-dir ../../public/models --name person \
  --preview-dir out          # 可选：渲染多角度联系图 out/person-turntable.png
```

### 2) TripoSR（真正的 AI 补全，效果更好）

1. 下载权重：ModelScope 的 `stabilityai/TripoSR`（或 HuggingFace 同名仓库），把 **`model.ckpt`** 放进 `weights/`
   （官方 `config.yaml` 也一起放进去更稳妥，不放则使用内置的同款配置）。
2. 运行：

```bash
./run.sh generate --backend triposr \
  --image ../../public/reference.jpg \
  --mask  ../../public/photo3d/person-mask.png \
  --out-dir ../../public/models --name person \
  --resolution 256 --device cpu \
  --preview-dir out --debug-dir out
```

- `--resolution`：Marching Cubes 分辨率，越大越细越慢（CPU 上 256 约几分钟）。
- `--device`：`cpu` 最稳；Apple 芯片可试 `mps`；有 N 卡用 `cuda`。
- 内存不够时调小 `--chunk`。
- 输出末尾会打印“朝向对齐 IoU”。低于 0.6 说明轮廓没对上，请检查遮罩。

## 查看

回到项目根目录 `npm run dev`，默认就是 “360° 模型” 模式。

## 已知局限

- 单张照片的背面一定是“猜”的；relief 后端只是合理的启发式，TripoSR 是学习到的先验，但脸和衣服细节仍可能不准。
- 照片里脚被裁掉了，TripoSR 会把腿补成一个自然结尾，不会是真实的鞋子。
- 照片投影只覆盖“面向拍摄相机且没被挡住”的表面，转过去会过渡到补全的顶点色，交界处会有轻微色差。
