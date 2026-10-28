/**
 * 武来模式渲染与模拟的性价比参数（改这里即可全局调优）。
 */
export const GAME_PERF = {
  /** 设备像素比上限：减轻 GPU  fill，高 DPI 屏更顺 */
  dpr: [1, 1.5],
  /** 主方向光阴影贴图边长 */
  shadowMapSize: 1024,
  /** 地面网格分段（260m 地图；略降可换帧率） */
  terrainSegments: 176,
  /** drei Environment 立方体分辨率 */
  environmentResolution: 48,
  /** 草簇散布数量（Instanced 顶点量） */
  grassClusterCount: 880,
  /** 首屏：资源就绪后至少等若干帧再预热（等 Player/FX 挂载） */
  skillWarmupAfterFrames: 2,
  /** 找不到 FX 根节点时最多再等多少帧 */
  skillWarmupMaxFrames: 300,
  /** 遮罩上等待预热的兜底超时（毫秒） */
  skillWarmupTimeoutMs: 12000,
  /** 预热阶段是否顺带 compile 整场景（移动端首技能更稳，略增进图时间） */
  skillWarmupFullScene: true,
};
