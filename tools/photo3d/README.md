# 照片 → 深度 / 补洞背景 的预处理脚本

产物已经放在 `public/photo3d/`，运行项目不需要重新跑这里的脚本。
想换一张照片时：

1. `npm i onnxruntime-node sharp`（macOS 13 及以下需用 `onnxruntime-node@1.18.0`）
2. 下载模型（GitHub Releases）：
   - 深度：`fabio-sim/Depth-Anything-ONNX` v2.0.0 → `depth_anything_v2_vits_dynamic.onnx`
   - 抠图：`danielgatis/rembg` v0.0.0 → `u2net_human_seg.onnx`
3. `node infer.mjs`（先出深度图；`SEG=1 node infer.mjs` 再出抠图）
4. `node prep.mjs` 生成 `public/photo3d/{color.jpg,depth.png,bg-color.jpg,bg-depth.png}`

脚本里的路径是我本机的绝对路径，换机器需要自行修改。
