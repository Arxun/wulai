/**
 * 可复现的随机 / 噪声工具。
 * 程序化建模里“同一个 seed 每次刷新结果一致”很重要，所以不直接用 Math.random。
 */

/**
 * 可复现的伪随机数生成器（mulberry32）。
 * @param {number} seed 种子
 * @returns {() => number} 每次调用返回 [0, 1) 的数
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 按顶点位置生成 [0, 1) 的噪声。
 * 注意不能对每个顶点单独用随机数：圆柱 / 锥体接缝处有重复顶点，
 * 用“位置”做哈希可以保证重复顶点得到相同结果，不会撕裂。
 */
export function hash3(x, y, z, seed = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 13.37) * 43758.5453;
  return s - Math.floor(s);
}

/** 把数值限制在 [min, max] */
export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** 线性插值 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
