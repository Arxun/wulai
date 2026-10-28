# 把 TripoSR 权重放在这里

需要的文件：

| 文件 | 必须 | 来源 |
| --- | --- | --- |
| `model.ckpt` | 是（约 1.7 GB） | ModelScope `stabilityai/TripoSR` 或 HuggingFace `stabilityai/TripoSR` |
| `config.yaml` | 否 | 同上；不放则使用 `i23d/configs/triposr.yaml`（同款结构） |

放好之后运行 `../run.sh generate --backend triposr ...`（见上一级 README）。
`model.ckpt` 体积很大，已在 `.gitignore` 里忽略。
