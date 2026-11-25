---
name: wulai-drive-clip
description: 武来（mountain-3d）开车防穿模：车身贴可见山坡、开车时被树和石头挡住，以及这件事在移动端的耗时预算。改 SU7 贴地、地形高度采样、开车碰撞、山里穿模时使用；用户问开车穿模、扎进山里、车穿树，或担心这套逻辑让手机变卡时也使用。
---

# 武来 · 开车防穿模

画面上的山是三角面，车有四米多长。只取车心一个高度、再保持水平，上坡时车头和底盘会扎进山里。树和石头以前没有碰撞，车会从中间开过去。

防穿模只动模拟，不加网格、光源、材质或阴影。

## 贴地

`src/scenes/game/vehicles/carGround.js`

- 四轮采样估俯仰和侧倾，车身探针（保险杠、底盘、四角）再把整车抬到地面之上。
- 采样高度用 `surfaceHeight`：`terrainHeight` 和 `groundMeshHeight` 里更高的那个。宁肯略浮，不要陷进可见三角面。
- `groundMeshHeight` 的对角线必须和 `PlaneGeometry.rotateX(-π/2)` 一致：顶点写的是 `(x, -y)`，行号跟着世界 Z 增大。反了对角线，格子中间仍会穿模。
- 分段数用 `terrainSegmentCount()`，不要在采样循环里调用 `getGamePerf()`（移动端每次都会 `new` 一份配置）。
- 俯仰、侧倾限制在约 0.62 弧度。更陡的坡靠把整车抬高来躲开，不要让车竖起来。
- 轮胎接触点允许比地面低一个 `sink`（现在 0.06），和原来平地的坐姿一致。底盘探针要加上这个下沉，否则车身仍会埋进去。

`applyCarGroundFit`（`vehicles/runtime.js`）每帧由 `Player` 调用，`Su7Car` 只读 `carPitch` / `carRoll` / `carGroundY`。

- 抬头快、下落慢，避免车头先扎进坡里再慢慢抬。
- 车停稳（不在车上，且俯仰侧倾已经跟上）后直接返回，走路时不要每帧重算。
- 换位置或召唤后清掉 `fitStable`，否则车还停在旧坡度上。

## 挡树和石头

`src/scenes/game/maps/huangshan/props.js` 与 `obstacles.js` 的 `resolveDriveBlockers`。

- 树、石头的位置只生成一次，画面散布和碰撞共用 `getHuangshanProps()`，不要各算一份。
- 碰撞体是圆，放进 8 米一格的网格。开车时只查车周围 9 格，用已有的圆对车身 OBB，把车往反方向推开。
- **只在 `vehicle.inCar` 时调用。** 走路仍可穿过林子。
- 半径比树冠、石块略小，山路中心（出生点、路点）必须开得过去。不要给每棵树挂 Mesh 或物理体。

## 移动端耗时

按移动端地面分段（156）在开发机上测过，单帧：

| 情况 | 耗时 |
| --- | --- |
| 开车贴地（`applyCarGroundFit`） | 0.16 ms |
| 挡树挡石 | 0.005 ms |
| 车已经停稳 | 0.0006 ms |
| 镜头多一次贴地采样 | 0.006 ms |

手机主线程按开发机的 4～6 倍估，开车大约 1 ms，不到一帧的一成。没有新增 draw call。地形分段、阴影、像素比都不为这件事改。

重测时用临时脚本走 Vite `ssrLoadModule`，先 `setGamePerfMobile(true)`，测完删掉脚本。不要把脚本留在仓库里。

## 不要做

- 不要靠提高 `terrainSegments` 来防穿模。分段只影响三角形大小，查询本身是 O(1)。
- 不要在 `useFrame` 里 `new` 向量，贴地用的是模块级 `Euler` / `Quaternion` / `Vector3`。
- 不要每帧遍历全部树。全图大约 400 个圆，线性扫会在手机上变成固定开销。
- 不要把行走碰撞也打开，那会改变打怪走位。
- 停着的车贴稳之后不要继续采样。

## 相关文件

- `src/scenes/game/vehicles/carGround.js` 贴地采样
- `src/scenes/game/vehicles/runtime.js` `applyCarGroundFit`
- `src/scenes/game/vehicles/su7/Su7Car.jsx` 把俯仰侧倾写到车根节点，旋转顺序 `YXZ`
- `src/scenes/game/hero/Player.jsx` 开车时推开障碍，并让镜头不低于 `surfaceHeight`
- `src/scenes/game/maps/huangshan/heightfield.js` `groundMeshHeight`
- `src/scenes/game/maps/huangshan/props.js` 散布和碰撞圆
- `src/scenes/game/maps/huangshan/obstacles.js` `resolveDriveBlockers`

## 验收

`src/scenes/game/__tests__/wulai-modules.test.js` 里要保持这几条：

- 平地几乎不倾斜，高度仍是地面减去 `sink`
- 陡坡上车身采样不会埋进可见地面（间隙不低于约 -0.1）
- 格子内部高度落在 `PlaneGeometry` 的三角面上
- 出生点和山路点开车不被挡住，车心放在巨石上会被推出去

改完跑：`source ~/.nvm/nvm.sh && nvm use 20 && yarn test src/scenes/game/__tests__/wulai-modules.test.js`
