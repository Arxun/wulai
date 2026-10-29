---
name: wulai-perf-standards
description: 武来（mountain-3d）游戏的渲染性能约束与验收流程：点光源池、着色器预热、InstancedMesh 合批、逐帧逻辑、模型压缩和性能探针。在这个项目里新增或修改技能特效、武器、掉落物、怪物、载具、场景物件、材质或光源时使用；用户提到卡顿、掉帧、流畅、优化、draw call、首次释放卡时也使用。
---

# 武来 · 性能开发标准

核心目标：**游戏流畅，且优化不能引入 bug**。画面必须和改动前一致；拿不准会不会改变画面的优化就不做，先跟用户说明。

## 1. 光源：绝不在运行时改变点光数量

three.js 的可见点光数量一变，所有受光材质都会重新编译着色器，造成首次放技能或换武器时卡 2～3 秒。

- 特效、武器、掉落物、载具里**禁止直接写 `<pointLight>`**。改用 `FxLight`（`src/scenes/game/fx/FxLight.jsx`），用法和属性跟 `pointLight` 一样（`color` / `intensity` / `distance` / `decay`，ref 上可以直接改 `.intensity`）。
- `FxLight` 只是一个"申请"，真正亮的是 `FxLightPool` 里 4 盏常驻光源，按距离和亮度挑选。
- 任何会渲染游戏武器或特效的场景都必须挂一个 `<FxLightPool />`（目前在 `GameScene` 和 `LowPolyScene` 里）。
- 不要对包含真实光源的父节点切换 `visible`，也不要条件渲染真实光源。

## 2. 着色器：不在运行时产生新的材质变体

- 新的技能特效根节点必须调用 `useSkillFxWarmupRoot(root, { tier })`，大招用 `tier: 'ult'`，让进图后的预热能覆盖到。
- 运行中不要切换会改变着色器的材质属性：`transparent`、`vertexColors`、`flatShading`、`map`、`onBeforeCompile`、`side` 等。需要两种状态时，提前建两份材质或两个批次。
- `InstancedMesh` 的 `instanceColor` 要在创建时就 `setColorAt` 全部填好，不要第一次用时才创建（会多出一个新变体）。
- 不要遍历大量物体逐个改材质（例如旧的 `paintBody`），改为由状态推导出该走哪个批次或用哪种实例颜色。

## 3. Draw call：重复物体一律合批

- 同一几何体出现约 10 次以上，就用 `InstancedMesh`。
- **特效粒子**：用 `makeFxBatch(geometry, material, colors, { opacity })`（`src/scenes/game/skills/fx/fxBatch.js`）。逐帧照旧改 `items[i]` 的 position / rotation / scale / opacity，改完调 `sync()`。
  - 每个批次都要 new 一份自己的几何体，因为 `aAlpha` 会挂在几何体上，不能共用。
  - 逐实例透明度用 `instanceAlpha`，**不要把 opacity 乘进颜色里**：有色调映射时两者结果不同。
- **多零件生物或物件**：参照 `src/scenes/game/monsters/monsterBatch.js`，把零件矩阵烘焙进几何体，按材质参数（如 roughness）分组合并。
  - 镜像零件（scale x = -1）烘焙后必须翻转三角形绕序，否则会被背面剔除。
- 实例会移动的 `InstancedMesh`：设 `frustumCulled = false`，`instanceMatrix.setUsage(THREE.DynamicDrawUsage)`。
- **只合批加法混合（Additive）的透明物体**。普通混合的半透明面（深色裂缝等）如果和加法粒子叠在一起，就保持独立网格，因为合批会改变绘制先后，造成细微变色。
- 每段几何不同、无法实例化的物件，数量不多时保持原样，不要为了合批而重写造型。

## 4. 逐帧逻辑

- 大量同类实体共用一个 `useFrame` 统一驱动（参照 `Monsters.jsx`），不要每个实体各开一个。
- `useFrame` 里不要分配对象，复用模块级的 `Vector3`、`Matrix4`、`Quaternion`。
- 不要在 render 里或 `useFrame` 里 setState。跨组件上报进度一类的需求，用 store 的 `subscribe` 加 rAF（参照 `GameLoadReporter.jsx`），不要在 render 里调用会更新其他组件的 hook。

## 5. 模型资源

- glTF 只用 Draco 压缩：`yarn model:su7-draco`（`gltf-transform draco`）。
- **禁止 `gltf-transform optimize`**：它会拍平节点层级，导致车轮等子节点动画失效。
- GLTFLoader 会清洗节点名（`Wheel.001` 变成 `Wheel001`），按名字查找节点时正则要兼容两种写法。

## 6. 验收流程（涉及渲染的改动必须走完）

```
- [ ] yarn test 全部通过（需 Node 20：source ~/.nvm/nvm.sh; nvm use 20）
- [ ] yarn build 通过
- [ ] 性能探针 ?perf=auto 达标（标准见下）
- [ ] 改了渲染路径：新旧版本同机位截图对比，画面一致
- [ ] 控制台无报错、无警告
```

**性能探针**：访问 `http://localhost:5173/wulai/?perf=auto`，它会自动跑一遍连招、技能、大招、换武器、掉落，并在 Console 输出 `[PERF-PROBE]` JSON。`?perf=1` 是手动模式，每 5 秒输出一次，同时暴露 `window.__perfScene`。

达标标准：

| 指标 | 要求 |
| --- | --- |
| `newPrograms` | 每一步都是 0 |
| `pointLights` | 始终是 4 |
| `maxFrameMs` | 每一步不超过约 20ms |
| `maxDrawCalls` | 不高于基线：平时约 214，放大招约 660 |

**新旧对比**：用 `git worktree add --detach /tmp/<目录> HEAD` 检出旧版，软链 `node_modules`，在另一个端口跑 `npx vite --port 5199`。不要用 `git stash` 动用户的工作区。对比完删除 worktree。

**无头浏览器**（截图、CDP 脚本用）：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --enable-gpu --use-angle=metal --ignore-gpu-blocklist \
  --remote-debugging-port=9333 --user-data-dir=/tmp/wulai-chrome \
  "http://localhost:5173/wulai/?perf=1"
```

开发期全局变量：`window.__pl`、`__world`、`__combat`、`__vehicle`（由 Player 设置），`__perfScene`（由 PerfProbe 设置）。

## 7. 新增单测

改动合批、几何烘焙或光源池逻辑时，在 `src/scenes/game/__tests__/wulai-modules.test.js` 里补测试，最好用变异测试确认：故意改坏实现时，测试确实会失败。
