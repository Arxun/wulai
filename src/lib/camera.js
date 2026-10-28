/**
 * 相机相关的纯函数。
 */

/**
 * 让一张宽 1、高 aspect 的平面在距离 distance 处刚好铺满竖直视野所需的垂直 FOV（度）。
 * 用于“相机在照片平面正前方”的场景（照片视差）。
 */
export function fovToFitPlane(aspect, distance) {
  return (2 * Math.atan(aspect / 2 / distance) * 180) / Math.PI;
}

/**
 * 给定包围球半径，算相机需要退多远才能完整看到它（竖直方向）。
 * @param {number} radius 包围球半径
 * @param {number} fovDeg 垂直 FOV（度）
 * @param {number} [padding] 额外留白倍数
 */
export function distanceToFitSphere(radius, fovDeg, padding = 1.15) {
  return (radius * padding) / Math.sin((fovDeg * Math.PI) / 360);
}
