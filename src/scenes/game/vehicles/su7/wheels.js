/**
 * SU7 轮子：旋转逻辑见 replicaCar.js；此处为武来绑定（ShaChe、可选四轮镜像）。
 */
export {
  REPLICA_WHEEL_SPIN,
  replicaBindWheelModel,
  replicaUpdateWheels,
} from './replicaCar';

import { replicaBindWheelModel, replicaUpdateWheels } from './replicaCar';

/** @deprecated 与 REPLICA_WHEEL_SPIN 相同，测试/旧引用保留 */
export const SU7_WHEEL_SPIN_K = 0.03;

export const SU7_WHEEL_HALF_TRACK = 0.82;
export const SU7_MIRROR_WHEELS = false;

/** GLTFLoader 会去掉节点名里的 `.`（Wheel.001 → Wheel001） */
const TEMPLATE_NAME = /^Wheel\.?\d+$/;
const WHEEL_CHILD = /^Wheel\.?\d/;
const SETUP_KEY = 'su7WheelMirrored';

export const getSu7WheelHub = replicaBindWheelModel;

function pinFixedBrakes(scene) {
  const shache = scene.getObjectByName('ShaChe');
  if (!shache) return;
  const root = scene.getObjectByName('Sketchfab_model.001') ?? scene;
  root.attach(shache);
}

function ensureMirroredWheelChildren(hub) {
  if (!SU7_MIRROR_WHEELS || !hub || hub.userData[SETUP_KEY]) return;
  const templates = hub.children.filter((c) => TEMPLATE_NAME.test(c.name));
  for (const tpl of templates) {
    const { x, y, z } = tpl.position;
    for (const sign of [-1, 1]) {
      const side = sign > 0 ? 'R' : 'L';
      const clone = tpl.clone(true);
      clone.name = `${tpl.name}_${side}`;
      clone.visible = true;
      clone.position.set(x, y, z + sign * SU7_WHEEL_HALF_TRACK);
      hub.add(clone);
    }
    tpl.visible = false;
  }
  hub.userData[SETUP_KEY] = true;
}

/** 绑定 wheelModel（replica handleModel + 武来预处理） */
export function bindSu7WheelModel(scene) {
  pinFixedBrakes(scene);
  const hub = replicaBindWheelModel(scene);
  if (hub) ensureMirroredWheelChildren(hub);
  return hub;
}

export function listSu7WheelSpinNodes(wheelModel) {
  if (!wheelModel) return [];
  return wheelModel.children.filter((c) => c.visible && WHEEL_CHILD.test(c.name));
}

/** 测试用别名 */
export const updateSu7Wheels = replicaUpdateWheels;

export function setupSu7WheelSpinners(scene) {
  return listSu7WheelSpinNodes(bindSu7WheelModel(scene));
}
