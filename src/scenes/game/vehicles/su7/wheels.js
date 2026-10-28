import * as THREE from 'three';

/**
 * glTF 里只有 Wheel.001 / .002（沿 ±X 各一只，Z≈0），按 ±Z 镜像成四轮。
 * 车头为 glTF +X；SU7_MESH_YAW 在 Su7Car 外层再转。
 */
export const SU7_WHEEL_HALF_TRACK = 0.82;
/** 与 su7-replica Car.update 一致：角速度 ≈ speed * K */
export const SU7_WHEEL_SPIN_K = 0.032;

const WHEEL_NAME = /^Wheel\.\d+$/;
const SETUP_KEY = 'su7WheelSpinners';

/**
 * @param {THREE.Object3D} scene 克隆后的 sm_car 根
 * @returns {THREE.Object3D[]} 参与滚动的轮子根（4 个）
 */
export function setupSu7WheelSpinners(scene) {
  if (scene.userData[SETUP_KEY]) return scene.userData[SETUP_KEY];

  const spinners = [];
  const hub = scene.getObjectByName('Wheel');
  const parent = hub ?? scene;

  /** @type {THREE.Object3D[]} */
  const templates = [];
  parent.traverse((obj) => {
    if (WHEEL_NAME.test(obj.name)) templates.push(obj);
  });
  if (!templates.length) {
    scene.userData[SETUP_KEY] = spinners;
    return spinners;
  }

  for (const tpl of templates) {
    const { x, y, z } = tpl.position;
    for (const sign of [-1, 1]) {
      const side = sign > 0 ? 'R' : 'L';
      const clone = tpl.clone(true);
      clone.name = `${tpl.name}_${side}`;
      clone.visible = true;
      clone.position.set(x, y, z + sign * SU7_WHEEL_HALF_TRACK);
      parent.add(clone);
      spinners.push(clone);
    }
    tpl.visible = false;
  }

  scene.userData[SETUP_KEY] = spinners;
  return spinners;
}

/** 每帧在 Player 更新 driveSpeed 之后调用 */
export function tickSu7WheelSpin(spinners, speed, dt) {
  if (!spinners?.length || speed <= 0.001) return;
  const step = -speed * SU7_WHEEL_SPIN_K * Math.min(dt, 0.05);
  for (let i = 0; i < spinners.length; i++) {
    spinners[i].rotateZ(step);
  }
}
