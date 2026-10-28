import * as THREE from 'three';
import { ZERO_POSE } from '../../lib/animation/gait';
import { terrainHeight } from './heightfield';
import { SU7_DRIVER_LOCAL } from './su7DriverSeat';
import { SU7_SPAWN } from './worldObstacles';

/** 主驾：微前倾，朝方向盘 */
export const CAR_SIT_POSE = {
  ...ZERO_POSE,
  bodyY: 0,
  lean: 0.12,
  twist: 0,
  roll: 0,
  headPitch: -0.05,
  headYaw: 0.04,
  arms: [
    { shoulder: 0.38, elbow: 0.58, yaw: -0.06, roll: 0.04 },
    { shoulder: 0.34, elbow: 0.52, yaw: 0.1, roll: -0.03 },
  ],
};

/** 相机跟随：与 Furina 同一主驾锚点（车本地） */
export const SU7_SEAT = {
  x: SU7_DRIVER_LOCAL.x,
  y: SU7_DRIVER_LOCAL.y,
  z: SU7_DRIVER_LOCAL.z,
  yaw: SU7_DRIVER_LOCAL.rotY,
};

/** 与车身中心距离 ≤ 此值可 F 交互 */
export const CAR_INTERACT_DIST = 5;

/** 游戏模式默认在车外，靠近 SU7 按 F 上车 */
export const START_IN_SU7 = false;

export const vehicle = {
  near: false,
  inCar: false,
  /** Player 写入，Su7Car 内 DriverBust 读取 */
  poseRef: null,
};

const _tmp = new THREE.Vector3();

/** 车本地 → 世界（含地形 Y） */
export function carLocalToWorld(lx, ly, lz, out = _tmp) {
  const { x, z, rotationY, sink, scale = 1 } = SU7_SPAWN;
  const baseY = terrainHeight(x, z) - sink;
  const sx = lx * scale;
  const sy = ly * scale;
  const sz = lz * scale;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  out.set(x + sx * cos + sz * sin, baseY + sy, z - sx * sin + sz * cos);
  return out;
}

export function carWorldYaw() {
  return SU7_SPAWN.rotationY + (SU7_SEAT.yaw || 0);
}

export function distToCarCenter(px, pz) {
  return Math.hypot(px - SU7_SPAWN.x, pz - SU7_SPAWN.z);
}

export function updateCarProximity(px, pz) {
  vehicle.near = distToCarCenter(px, pz) <= CAR_INTERACT_DIST;
}

/** @returns {boolean} 是否切换了上下车状态 */
export function toggleSu7Entry(px, pz, playerState) {
  updateCarProximity(px, pz);
  if (vehicle.inCar) {
    exitSu7(playerState);
    return true;
  }
  if (!vehicle.near) return false;
  enterSu7(playerState);
  return true;
}

export function enterSu7(playerState) {
  vehicle.inCar = true;
  playerState.vel.set(0, 0, 0);
  playerState.knock.set(0, 0, 0);
  playerState.air = false;
  playerState.vy = 0;
  syncPlayerToSeat(playerState);
}

export function exitSu7(playerState) {
  vehicle.inCar = false;
  const out = carLocalToWorld(-1.05, 0, 0.65, new THREE.Vector3());
  playerState.pos.x = out.x;
  playerState.pos.z = out.z;
  playerState.pos.y = terrainHeight(out.x, out.z);
  playerState.yaw = carWorldYaw() + Math.PI * 0.45;
  playerState.vel.set(0, 0, 0);
}

export function syncPlayerToSeat(playerState) {
  const seat = carLocalToWorld(SU7_SEAT.x, SU7_SEAT.y, SU7_SEAT.z, new THREE.Vector3());
  playerState.pos.copy(seat);
  playerState.yaw = carWorldYaw();
}
