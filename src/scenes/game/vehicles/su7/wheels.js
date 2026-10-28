import * as THREE from 'three';

/**
 * glTF 里只有 Wheel.001 / .002（沿 ±X 各一只，Z≈0），按 ±Z 镜像成四轮。
 * 车头为 glTF +X；SU7_MESH_YAW 在 Su7Car 外层再转。
 */
export const SU7_WHEEL_HALF_TRACK = 0.82;

const WHEEL_NAME = /^Wheel\.\d+$/;

/**
 * @param {THREE.Object3D} scene 克隆后的 sm_car 根
 * @returns {THREE.Object3D[]} 参与 rotateZ 的轮子根节点（4 个）
 */
export function setupSu7WheelSpinners(scene) {
  const spinners = [];
  const hub = scene.getObjectByName('Wheel');
  const parent = hub ?? scene;

  /** @type {THREE.Object3D[]} */
  const templates = [];
  parent.traverse((obj) => {
    if (WHEEL_NAME.test(obj.name)) templates.push(obj);
  });
  if (!templates.length) return spinners;

  for (const tpl of templates) {
    tpl.visible = false;
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
  }

  return spinners;
}
