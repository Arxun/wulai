/**
 * 共享点光池的请求表。
 *
 * three 会把「可见点光数量」编进每个受光材质的 shader；数量一变全场材质换 program，
 * 第一次出现的数量还要现编（首放技能 / 换武器 / 掉落时的卡顿）。
 * 所以场景里只保留 FX_LIGHT_SLOTS 盏永远可见的真实点光，特效、武器、掉落物只提交请求。
 */

export const FX_LIGHT_SLOTS = 4;

/** @type {Map<string, { x: number, y: number, z: number, r: number, g: number, b: number, intensity: number, distance: number, decay: number, frame: number }>} */
const requests = new Map();
let poolFrame = 0;

export function getFxLightFrame() {
  return poolFrame;
}

export function requestFxLight(key, x, y, z, color, intensity, distance, decay) {
  let req = requests.get(key);
  if (!req) {
    req = { x: 0, y: 0, z: 0, r: 1, g: 1, b: 1, intensity: 0, distance: 0, decay: 2, frame: 0 };
    requests.set(key, req);
  }
  req.x = x;
  req.y = y;
  req.z = z;
  req.r = color.r;
  req.g = color.g;
  req.b = color.b;
  req.intensity = intensity;
  req.distance = distance;
  req.decay = decay;
  req.frame = poolFrame;
}

export function releaseFxLight(key) {
  requests.delete(key);
}

/** 越亮、照得越远、离镜头越近的请求越优先 */
export function scoreFxLight(req, cx, cy, cz) {
  const d = Math.hypot(req.x - cx, req.y - cy, req.z - cz);
  const reach = req.distance > 0 ? req.distance : 10;
  return (req.intensity * reach) / (1 + d * 0.08) ** 2;
}

const picked = [];

/**
 * 挑出本帧要点亮的请求；同时清掉上一帧之后没再提交的请求，并推进帧号。
 * @returns {Array} 最多 slots 个请求，按分数从高到低
 */
export function pickFxLights(cx, cy, cz, slots = FX_LIGHT_SLOTS) {
  picked.length = 0;
  for (const [key, req] of requests) {
    if (req.frame < poolFrame - 1) {
      requests.delete(key);
      continue;
    }
    if (req.intensity <= 0.01) continue;
    req.score = scoreFxLight(req, cx, cy, cz);
    picked.push(req);
  }
  picked.sort((a, b) => b.score - a.score);
  if (picked.length > slots) picked.length = slots;
  poolFrame += 1;
  return picked;
}

export function resetFxLights() {
  requests.clear();
  poolFrame = 0;
}
