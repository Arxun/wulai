import * as THREE from 'three';
import { groundMeshHeight, terrainHeight } from '../maps/huangshan/heightfield';

/**
 * 车身贴地。高度场是光滑的，画面上的山是一块块三角面，
 * 车又有四米多长：只取车心一个高度、再保持水平，上坡时车头会扎进山里。
 * 这里按四轮估俯仰和侧倾，再把保险杠和底盘抬到可见地面之上。
 */

const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();

/** 车根节点局部坐标：左右、离地、前后。+Z 是车头 */
const WHEELS = [
  [-0.82, 0, 1.48],
  [0.82, 0, 1.48],
  [-0.82, 0, -1.48],
  [0.82, 0, -1.48],
];
const BODY = [
  [0, 0.16, 2.2],
  [0, 0.16, -2.05],
  [0, 0.12, 0],
  [-0.72, 0.14, 1.75],
  [0.72, 0.14, 1.75],
  [-0.72, 0.14, -1.55],
  [0.72, 0.14, -1.55],
];

const MAX_TILT = 0.62;

/** 可见三角面和高度场里更高的那个，车宁肯略浮也不要陷进去 */
export function surfaceHeight(x, z) {
  const field = terrainHeight(x, z);
  const mesh = groundMeshHeight(x, z);
  return field > mesh ? field : mesh;
}

function sampleWheels(x, z, yaw, scale) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const h = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const lx = WHEELS[i][0] * scale;
    const lz = WHEELS[i][2] * scale;
    h[i] = surfaceHeight(x + lx * cos + lz * sin, z - lx * sin + lz * cos);
  }
  return h;
}

export function measureCarSlope(x, z, yaw, scale = 1) {
  const [fl, fr, rl, rr] = sampleWheels(x, z, yaw, scale);
  const axle = 1.48 * 2 * scale;
  const track = 0.82 * 2 * scale;
  let pitch = Math.atan2((rl + rr) * 0.5 - (fl + fr) * 0.5, axle);
  let roll = Math.atan2((fr + rr) * 0.5 - (fl + rl) * 0.5, track);
  if (pitch > MAX_TILT) pitch = MAX_TILT;
  else if (pitch < -MAX_TILT) pitch = -MAX_TILT;
  if (roll > MAX_TILT) roll = MAX_TILT;
  else if (roll < -MAX_TILT) roll = -MAX_TILT;
  return { pitch, roll };
}

function clearance(x, z, yaw, pitch, roll, scale, sink) {
  _e.set(pitch, yaw, roll);
  _q.setFromEuler(_e);
  let y = -Infinity;
  const take = (lx, ly, lz, pad) => {
    _p.set(lx * scale, ly * scale, lz * scale).applyQuaternion(_q);
    const g = surfaceHeight(x + _p.x, z + _p.z);
    const need = g + pad - _p.y;
    if (need > y) y = need;
  };
  for (let i = 0; i < WHEELS.length; i++) take(WHEELS[i][0], WHEELS[i][1], WHEELS[i][2], 0);
  for (let i = 0; i < BODY.length; i++) take(BODY[i][0], BODY[i][1], BODY[i][2], sink + 0.03);
  return y - sink;
}

/** 这一帧该摆的车姿。y 是车根节点的世界高度（已经含下沉） */
export function fitCarToGround(x, z, yaw, scale = 1, sink = 0, orient = null) {
  const slope = orient || measureCarSlope(x, z, yaw, scale);
  const y = clearance(x, z, yaw, slope.pitch, slope.roll, scale, sink);
  return { y, pitch: slope.pitch, roll: slope.roll };
}

/** 车身采样点比可见地面高出多少。负数表示还埋在山里 */
export function carPoseGap(x, z, yaw, pose, scale = 1) {
  _e.set(pose.pitch, yaw, pose.roll);
  _q.setFromEuler(_e);
  let gap = Infinity;
  const take = (lx, ly, lz) => {
    _p.set(lx * scale, ly * scale, lz * scale).applyQuaternion(_q);
    const worldY = pose.y + _p.y;
    const g = surfaceHeight(x + _p.x, z + _p.z);
    const d = worldY - g;
    if (d < gap) gap = d;
  };
  for (let i = 0; i < WHEELS.length; i++) take(WHEELS[i][0], WHEELS[i][1], WHEELS[i][2]);
  for (let i = 0; i < BODY.length; i++) take(BODY[i][0], BODY[i][1], BODY[i][2]);
  return gap;
}
