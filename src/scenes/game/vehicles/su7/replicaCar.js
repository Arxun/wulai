/**
 * su7-replica `Car.ts` 轮子部分原样移植（同一 sm_car.gltf）。
 *
 * - handleModel: this.wheelModel = modelParts[35]  →  Group 名 `Wheel`
 * - update: wheelModel.children.forEach(item => item.rotateZ(-params.speed * 0.03))
 *
 * replica 里 speed 是 GSAP 驱动的展示参数（点车 rush 时 0→4→10），不是物理车速；
 * 武来用 driveSpeed（m/s）代入同一公式，并乘 dt 对齐 60fps。
 */

export const REPLICA_WHEEL_SPIN = 0.03;

/** @see Car.handleModel */
export function replicaBindWheelModel(scene) {
  return scene.getObjectByName('Wheel') ?? null;
}

/**
 * @see Car.update
 * @param {THREE.Object3D | null} wheelModel
 * @param {number} speed replica params.speed / 武来 driveSpeed
 * @param {number} [dt] 帧间隔；传入则 step 乘 min(dt,0.05)*60
 */
export function replicaUpdateWheels(wheelModel, speed, dt) {
  if (!wheelModel || speed <= 0) return;
  const scale = dt != null ? Math.min(dt, 0.05) * 60 : 1;
  const step = -speed * REPLICA_WHEEL_SPIN * scale;
  const children = wheelModel.children;
  for (let i = 0; i < children.length; i++) {
    children[i].rotateZ(step);
  }
}
