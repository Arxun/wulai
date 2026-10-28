import * as THREE from 'three';
import { bump, fbm2, ridged2 } from '../../../../lib/math/noise';

/**
 * 游戏地图的高度场：一条蜿蜒的山路穿过山谷，四周被山脊环抱，西北角有一座主峰。
 *
 * 全部是纯函数，地形网格、植被散布、玩家脚下的高度都查同一个 terrainHeight，
 * 所以人永远不会浮空或者陷进地里。
 */

/** 地图尺寸（米），玩家活动范围是 ±(HALF - 5) */
export const MAP_SIZE = 260;
export const HALF = MAP_SIZE / 2;

/** 出生点（谷底山路边），周围抬成一块石台 */
export const SPAWN = [-4, 12];
/** 出生点清怪半径：台子周围这么远不刷怪 */
export const SPAWN_SAFE = 15;
/** 出生石台半径 6 米，内侧铺平，外沿收边 */
const PAD_INNER = 5.2;
const PAD_OUTER = 6;

/** 山路的控制点 [x, z]：从南边（+Z）一路蜿蜒上到北边（-Z） */
export const PATH = [
  [9, 118],
  [4, 96],
  [16, 76],
  [8, 56],
  [-12, 40],
  [-6, 18],
  [10, 2],
  [16, -18],
  [-4, -38],
  [-20, -58],
  [-12, -80],
  [6, -100],
  [4, -120],
];

/** 路面半宽，以及路肩过渡的宽度 */
const ROAD_HALF = 1.2;
const ROAD_FADE = 4.4;
/** 路面相对原始地形最多能挖 / 填多少米——不限制的话平滑后的路会在山脊处挖出一条峡谷 */
const ROAD_CUT = 3.5;

/** 不含山路的"原始"地形：起伏 + 环抱的山脊 + 一座主峰 */
function baseHeight(x, z) {
  const r = Math.hypot(x, z);
  // 谷底的缓坡起伏
  let h = (fbm2(x * 0.021, z * 0.021, { seed: 3, octaves: 4 }) - 0.5) * 13;
  // 四周隆起的山脊：离地图中心越远越高，形成一个环抱的山谷
  const rim = THREE.MathUtils.smoothstep(r, 48, 128);
  h += ridged2(x * 0.026, z * 0.026, { seed: 7, octaves: 4 }) * 32 * rim;
  h += rim * rim * 18;
  // 西北方向的主峰
  h += 30 * bump(x, -72, 24) * bump(z, -66, 28);
  // 东南方向一座次峰
  h += 16 * bump(x, 78, 18) * bump(z, 58, 20);
  // 西南再鼓一座，把新扩出来的空地填上
  h += 18 * bump(x, -88, 20) * bump(z, 62, 22);
  // 中段一小片台地，让路好走
  h -= 3 * bump(x, 2, 16) * bump(z, 8, 18);
  return h;
}

/**
 * 山路各控制点的高程：取原始地形的高度，沿路平滑几遍（路才不会忽上忽下），
 * 最后再钳回原始地形附近，避免在山脊处挖出深沟、在洼地架起高堤。
 */
const PATH_Y = (() => {
  const base = PATH.map(([x, z]) => baseHeight(x, z));
  const ys = base.slice();
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < ys.length - 1; i++) ys[i] = (ys[i - 1] + ys[i] * 1.4 + ys[i + 1]) / 3.4;
  }
  return ys.map((y, i) => THREE.MathUtils.clamp(y, base[i] - ROAD_CUT, base[i] + ROAD_CUT));
})();

/**
 * 点到山路的最短距离，以及该处路面的高程。
 * @returns {{dist:number, y:number}}
 */
export function nearestPath(x, z) {
  let best = Infinity;
  let y = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i];
    const [bx, bz] = PATH[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1);
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      y = THREE.MathUtils.lerp(PATH_Y[i], PATH_Y[i + 1], t);
    }
  }
  return { dist: best, y };
}

/** 出生台：1 在台面中间，0 已离开斜坡 */
export function spawnPadFactor(x, z) {
  const d = Math.hypot(x - SPAWN[0], z - SPAWN[1]);
  return 1 - THREE.MathUtils.smoothstep(d, PAD_INNER, PAD_OUTER);
}

/** 路面权重：0 完全不在路上，1 在路中间 */
export function roadFactor(x, z, dist) {
  const d = dist ?? nearestPath(x, z).dist;
  return 1 - THREE.MathUtils.smoothstep(d, ROAD_HALF, ROAD_FADE);
}

const PAD_Y = nearestPath(SPAWN[0], SPAWN[1]).y + 0.55;

/** 最终地形高度：把路面附近压平到路的高程，并略微下切出车辙感 */
export function terrainHeight(x, z) {
  const raw = baseHeight(x, z);
  const { dist, y } = nearestPath(x, z);
  const road = roadFactor(x, z, dist);
  let h = raw;
  if (road > 0) {
    const rut = -0.18 * road + 0.12 * Math.max(0, 1 - Math.abs(dist - ROAD_FADE * 0.6) / 2);
    h = THREE.MathUtils.lerp(raw, y + rut, road * road * (3 - 2 * road));
  }
  const pad = spawnPadFactor(x, z);
  if (pad > 0) h = THREE.MathUtils.lerp(h, PAD_Y, pad * pad * (3 - 2 * pad));
  return h;
}

/** 地表法线（用有限差分估），用来判断坡度 */
export function terrainNormal(x, z, eps = 0.6) {
  const hL = terrainHeight(x - eps, z);
  const hR = terrainHeight(x + eps, z);
  const hD = terrainHeight(x, z - eps);
  const hU = terrainHeight(x, z + eps);
  return new THREE.Vector3(hL - hR, 2 * eps, hD - hU).normalize();
}

/** 坡度（0 平地，1 垂直） */
export function slopeAt(x, z) {
  return 1 - terrainNormal(x, z).y;
}
