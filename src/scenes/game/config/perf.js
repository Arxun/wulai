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
  /** 首屏稳定后再预热技能着色器（帧数） */
  skillWarmupAfterFrames: 5,
};
