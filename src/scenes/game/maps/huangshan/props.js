import { HALF, SPAWN, nearestPath, slopeAt, spawnPadFactor, terrainHeight } from './heightfield';
import { mulberry32 } from '../../../../lib/math/random';

/**
 * 黄山步道上的树和石头。画面散布和开车碰撞用同一份点，
 * 避免车被一块看不见的墙挡住，或者从树干中间开过去。
 */

export function scatterPoints({ count, seed, height = [-99, 99], maxSlope = 0.5, minPath = 4, edge = 6 }) {
  const rnd = mulberry32(seed);
  const out = [];
  const limit = HALF - edge;
  for (let tries = 0; tries < count * 60 && out.length < count; tries++) {
    const x = (rnd() * 2 - 1) * limit;
    const z = (rnd() * 2 - 1) * limit;
    const y = terrainHeight(x, z);
    if (y < height[0] || y > height[1]) continue;
    if (slopeAt(x, z) > maxSlope) continue;
    if (nearestPath(x, z).dist < minPath) continue;
    if (Math.hypot(x - SPAWN[0], z - SPAWN[1]) < 7 || spawnPadFactor(x, z) > 0.15) continue;
    out.push({ x, y, z, rot: rnd() * Math.PI * 2, s: 0.75 + rnd() * 0.55, v: Math.floor(rnd() * 3) });
  }
  return out;
}

let props = null;

export function getHuangshanProps() {
  if (props) return props;
  props = {
    conifer: scatterPoints({ count: 170, seed: 101, height: [4, 38], maxSlope: 0.52, minPath: 5 }),
    pine: scatterPoints({ count: 58, seed: 102, height: [-6, 28], maxSlope: 0.42, minPath: 3.2 }),
    broadleaf: scatterPoints({ count: 68, seed: 103, height: [-16, 10], maxSlope: 0.34, minPath: 4.5 }),
    rock: scatterPoints({ count: 130, seed: 104, maxSlope: 0.85, minPath: 2.6 }),
    boulder: scatterPoints({ count: 36, seed: 105, maxSlope: 0.7, minPath: 4 }),
  };
  return props;
}

/**
 * 开车时挡住车的圆。半径按树冠和石块的世界尺寸收一圈，
 * 比模型略小，路肩留得过的缝不会被封死。
 */
let blockers = null;
let grid = null;
const CELL = 8;
const _near = [];

function buildBlockers() {
  const items = getHuangshanProps();
  const list = [];
  const add = (arr, radius) => {
    for (let i = 0; i < arr.length; i++) {
      const it = arr[i];
      list.push({ x: it.x, z: it.z, r: radius * it.s });
    }
  };
  add(items.conifer, 1.15);
  add(items.pine, 0.85);
  add(items.broadleaf, 1.0);
  add(items.rock, 0.42);
  add(items.boulder, 1.35);
  const cells = new Map();
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    const key = `${Math.floor(b.x / CELL)},${Math.floor(b.z / CELL)}`;
    let bucket = cells.get(key);
    if (!bucket) {
      bucket = [];
      cells.set(key, bucket);
    }
    bucket.push(b);
  }
  blockers = list;
  grid = cells;
}

export function blockersNear(x, z) {
  if (!grid) buildBlockers();
  _near.length = 0;
  const ix = Math.floor(x / CELL);
  const iz = Math.floor(z / CELL);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const bucket = grid.get(`${ix + dx},${iz + dz}`);
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) _near.push(bucket[i]);
    }
  }
  return _near;
}

export function driveBlockerCount() {
  if (!blockers) buildBlockers();
  return blockers.length;
}
