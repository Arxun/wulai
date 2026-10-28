import { mulberry32 } from '../../../lib/math/random';
import { HALF, SPAWN, SPAWN_SAFE, nearestPath, slopeAt, terrainHeight } from '../maps/huangshan/heightfield';
import { MONSTER_KINDS } from './kinds';

export function pickSpot(rnd, spec = {}, minPlayer = SPAWN_SAFE) {
  const height = spec.height || [-99, 99];
  const maxSlope = spec.maxSlope ?? 0.5;
  const minPath = spec.minPath ?? 4;
  const near = spec.near;
  const limit = HALF - 10;
  for (let i = 0; i < 200; i++) {
    let x;
    let z;
    if (near && rnd() < 0.8) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * near[2];
      x = near[0] + Math.cos(a) * r;
      z = near[1] + Math.sin(a) * r;
    } else {
      x = (rnd() * 2 - 1) * limit;
      z = (rnd() * 2 - 1) * limit;
    }
    if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
    if (Math.hypot(x - SPAWN[0], z - SPAWN[1]) < minPlayer) continue;
    const y = terrainHeight(x, z);
    if (y < height[0] || y > height[1]) continue;
    if (nearestPath(x, z).dist < minPath) continue;
    if (slopeAt(x, z) > maxSlope) continue;
    return { x, z, y };
  }
  return { x: 18, z: -22, y: terrainHeight(18, -22) };
}

/** 全图怪物列表：模块级缓存，避免切进游戏模式时在 React mount 里重算 */
let cached = null;

export function getMonsterPack() {
  if (cached) return cached;
  const rnd = mulberry32(20261027);
  const list = [];
  let id = 1;
  for (const kind of Object.keys(MONSTER_KINDS)) {
    const spec = MONSTER_KINDS[kind];
    for (let i = 0; i < spec.count; i++) {
      const p = pickSpot(rnd, spec.zone, SPAWN_SAFE);
      list.push({
        id: id++,
        kind,
        x: p.x,
        y: p.y,
        z: p.z,
        homeX: p.x,
        homeZ: p.z,
        yaw: rnd() * Math.PI * 2,
        hp: spec.hp,
        dead: false,
        fade: 0,
        respawn: 0,
        cd: 0.6,
        hitLock: 0,
        burnLock: 0,
        hurt: 0,
        wander: 0,
        wx: 0,
        wz: 0,
      });
    }
  }
  cached = list;
  return cached;
}
