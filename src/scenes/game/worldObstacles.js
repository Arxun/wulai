import { SPAWN, terrainHeight } from './heightfield';

/**
 * 地图静态障碍（XZ 平面）。玩家用圆，车辆用旋转矩形近似车身。
 */

/** 与 GameScene / Su7CarPlacement 共用同一组摆放参数 */
/** 停在出生点东侧路边（走几步即到） */
export const SU7_SPAWN = {
  x: SPAWN[0] + 5,
  z: SPAWN[1] + 0.8,
  sink: 0.06,
  rotationY: Math.PI * 0.85,
  scale: 1,
  /** 本地 X=车宽一半，Z=车长一半（米，已含 scale） */
  halfWidth: 1.12,
  halfLength: 2.45,
};

/** 小武碰撞圆半径（略小于视觉体，手感更顺） */
export const PLAYER_COLLIDE_R = 0.42;

const obstacles = [
  {
    kind: 'obb',
    x: SU7_SPAWN.x,
    z: SU7_SPAWN.z,
    rotY: SU7_SPAWN.rotationY,
    halfW: SU7_SPAWN.halfWidth * SU7_SPAWN.scale,
    halfL: SU7_SPAWN.halfLength * SU7_SPAWN.scale,
  },
];

/**
 * 圆 vs 旋转矩形：若在内部或重叠，沿最短方向推出到圆外。
 * @returns {{ x: number, z: number, nx: number, nz: number, hit: boolean }}
 */
function resolveCircleOBB(px, pz, ob) {
  const cos = Math.cos(ob.rotY);
  const sin = Math.sin(ob.rotY);
  const dx = px - ob.x;
  const dz = pz - ob.z;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;

  const { halfW, halfL } = ob;
  const cx = Math.max(-halfW, Math.min(halfW, lx));
  const cz = Math.max(-halfL, Math.min(halfL, lz));
  let qx = lx - cx;
  let qz = lz - cz;
  let distSq = qx * qx + qz * qz;
  const r = PLAYER_COLLIDE_R;

  if (distSq > r * r - 1e-8) {
    return { x: px, z: pz, nx: 0, nz: 0, hit: false };
  }

  let nx;
  let nz;
  if (distSq < 1e-10) {
    const penX = halfW + r - Math.abs(lx);
    const penZ = halfL + r - Math.abs(lz);
    if (penX < penZ) {
      qx = Math.sign(lx || 1) * (halfW + r);
      qz = lz;
      nx = Math.sign(lx || 1);
      nz = 0;
    } else {
      qx = lx;
      qz = Math.sign(lz || 1) * (halfL + r);
      nx = 0;
      nz = Math.sign(lz || 1);
    }
  } else {
    const dist = Math.sqrt(distSq);
    const push = r - dist;
    nx = qx / dist;
    nz = qz / dist;
    qx = lx + nx * push;
    qz = lz + nz * push;
  }

  const wx = ob.x + qx * cos + qz * sin;
  const wz = ob.z - qx * sin + qz * cos;
  const wnx = nx * cos - nz * sin;
  const wnz = nx * sin + nz * cos;
  return { x: wx, z: wz, nx: wnx, nz: wnz, hit: true };
}

/**
 * 解析玩家位置，避免穿模。可多次迭代以处理角点。
 */
export function resolvePlayerObstacles(px, pz) {
  let x = px;
  let z = pz;
  let nx = 0;
  let nz = 0;
  let hit = false;
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const ob of obstacles) {
      const r = resolveCircleOBB(x, z, ob);
      if (r.hit) {
        x = r.x;
        z = r.z;
        nx = r.nx;
        nz = r.nz;
        hit = true;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, z, nx, nz, hit };
}

/** 贴地 Y（与 Su7CarPlacement 一致，供调试或扩展） */
export function su7GroundY() {
  return terrainHeight(SU7_SPAWN.x, SU7_SPAWN.z) - SU7_SPAWN.sink;
}
