import * as THREE from 'three';
import { ZERO_POSE } from '../../../lib/animation/gait';
import { HALF, terrainHeight } from '../maps/huangshan/heightfield';
import { combat } from '../stores/combatStore';
import { resolvePlayerObstacles } from '../maps/huangshan/obstacles';
import { SU7_DRIVER_LOCAL } from './su7/driverSeat';
import { DEFAULT_VEHICLE_ID, VEHICLE_DEFS } from './registry';

const spawn = VEHICLE_DEFS[DEFAULT_VEHICLE_ID].spawn;

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

export const SU7_SEAT = {
  x: SU7_DRIVER_LOCAL.x,
  y: SU7_DRIVER_LOCAL.y,
  z: SU7_DRIVER_LOCAL.z,
  yaw: SU7_DRIVER_LOCAL.rotY,
};

export const CAR_INTERACT_DIST = VEHICLE_DEFS[DEFAULT_VEHICLE_ID].interactDist;
export const START_IN_SU7 = VEHICLE_DEFS[DEFAULT_VEHICLE_ID].startInVehicle;

export const vehicle = {
  near: false,
  inCar: false,
  vehicleId: DEFAULT_VEHICLE_ID,
  poseRef: null,
  carX: spawn.x,
  carZ: spawn.z,
  carYaw: spawn.rotationY,
  sink: spawn.sink,
  scale: spawn.scale,
  driveSpeed: 0,
  /** Su7Car 挂上场景后为 true；占位模型不算加载完 */
  ready: false,
  /** Su7Car：`bindSu7WheelModel` 后的 Wheel 组（replica wheelModel） */
  wheelHub: null,
  /** 当前可见、会转的 hub.children（调试 __pl.wheelN） */
  wheelSpinners: [],
};

const _tmp = new THREE.Vector3();

export function activeVehicleSpeedMult() {
  return VEHICLE_DEFS[vehicle.vehicleId]?.speedMult ?? 1;
}

export function syncCarFromPlayer(playerState) {
  if (!vehicle.inCar) return;
  vehicle.carX = playerState.pos.x;
  vehicle.carZ = playerState.pos.z;
  vehicle.carYaw = playerState.yaw;
  vehicle.driveSpeed = Math.hypot(playerState.vel.x, playerState.vel.z);
}

export function carLocalToWorld(lx, ly, lz, out = _tmp) {
  const { carX: x, carZ: z, carYaw: rotationY, sink, scale = 1 } = vehicle;
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
  return vehicle.carYaw + (SU7_SEAT.yaw || 0);
}

export function distToCarCenter(px, pz) {
  return Math.hypot(px - vehicle.carX, pz - vehicle.carZ);
}

export function updateCarProximity(px, pz) {
  vehicle.near = distToCarCenter(px, pz) <= CAR_INTERACT_DIST;
}

const PLAY_LIMIT = HALF - 5;

/**
 * 把车放到玩家身侧（优先主驾那一侧），人站在车外、又在上车距离内。
 * 贴边时换另一侧或车头车尾，避免车心出空气墙。
 */
export function summonVehicleBeside(px, pz, yaw) {
  if (!vehicle.ready || vehicle.inCar) return false;
  const halfW = (spawn.halfWidth ?? 1.12) * (spawn.scale || 1);
  const halfL = (spawn.halfLength ?? 2.45) * (spawn.scale || 1);
  const side = halfW + 0.75;
  const fore = halfL + 0.85;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const spots = [
    [px + rx * side, pz + rz * side],
    [px - rx * side, pz - rz * side],
    [px - fx * fore, pz - fz * fore],
    [px + fx * fore, pz + fz * fore],
  ];
  let pick = null;
  for (const [x, z] of spots) {
    if (Math.abs(x) <= PLAY_LIMIT && Math.abs(z) <= PLAY_LIMIT) {
      pick = [x, z];
      break;
    }
  }
  if (!pick) {
    pick = [
      Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, spots[0][0])),
      Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, spots[0][1])),
    ];
  }
  vehicle.carX = pick[0];
  vehicle.carZ = pick[1];
  vehicle.carYaw = yaw;
  vehicle.driveSpeed = 0;
  updateCarProximity(px, pz);
  return true;
}

/** 按键和移动端按钮共用：没加载完给提示，已经在车上则不动 */
export function summonVehicleForPlayer(px, pz, yaw) {
  if (combat.dead || vehicle.inCar) return false;
  if (!vehicle.ready) {
    combat.toast = '载具加载中';
    combat.toastAge = 1.4;
    return false;
  }
  if (!summonVehicleBeside(px, pz, yaw)) return false;
  combat.toast = 'SU7 已到身边';
  combat.toastAge = 2.4;
  return true;
}

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
  playerState.charging = false;
  playerState.charge = 0;
  playerState.pos.set(vehicle.carX, terrainHeight(vehicle.carX, vehicle.carZ), vehicle.carZ);
  playerState.yaw = vehicle.carYaw;
}

export function exitSu7(playerState) {
  vehicle.inCar = false;
  vehicle.driveSpeed = 0;
  const car = { carX: vehicle.carX, carZ: vehicle.carZ, carYaw: vehicle.carYaw };
  const out = carLocalToWorld(-1.05, 0, 0.65, new THREE.Vector3());
  const col = resolvePlayerObstacles(out.x, out.z, { car });
  playerState.pos.x = col.x;
  playerState.pos.z = col.z;
  playerState.pos.y = terrainHeight(col.x, col.z);
  playerState.yaw = carWorldYaw() + Math.PI * 0.45;
  playerState.vel.set(0, 0, 0);
}
