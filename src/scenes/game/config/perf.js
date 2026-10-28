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
  /** 遮罩上等待预热的兜底超时（毫秒，仅 gateLoadingOnSkillWarmup 时生效） */
  skillWarmupTimeoutMs: 12000,
  /** true：资源 100% 后仍等预热结束才进图（移动端会明显变慢） */
  gateLoadingOnSkillWarmup: false,
  /** 预热是否 compile 整场景（true 更重；进图后后台预热时仍建议 false） */
  skillWarmupFullScene: false,
  /** 移动端：进图稳定后再预热（帧），避免与首帧抢 GPU */
  skillWarmupAfterFramesMobile: 90,
  /** 移动端：requestIdleCallback 最长等待（毫秒） */
  skillWarmupIdleTimeoutMs: 4000,
};

const MOBILE_OVERRIDES = {
  dpr: [1, 1],
  shadowMapSize: 512,
  terrainSegments: 120,
  environmentResolution: 32,
  grassClusterCount: 520,
};

let mobileGameActive = false;

/** App 在移动端游戏布局切换时同步（Canvas 内场景读 getGamePerf） */
export function setGamePerfMobile(active) {
  mobileGameActive = !!active;
}

export function isGamePerfMobile() {
  return mobileGameActive;
}

/** @returns {typeof GAME_PERF} */
export function getGamePerf() {
  if (!mobileGameActive) return GAME_PERF;
  return { ...GAME_PERF, ...MOBILE_OVERRIDES };
}
