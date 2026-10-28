import { SU7_SPAWN } from '../../maps/huangshan/obstacles';

/** 小米 SU7 */
export const SU7_VEHICLE = {
  id: 'su7',
  label: 'SU7',
  /** 相对步行 RUN_SPEED 的倍率（再叠氮气 BOOST_MULT） */
  speedMult: 1.65,
  interactDist: 5,
  startInVehicle: false,
  spawn: SU7_SPAWN,
  assets: {
    gltfKey: 'su7',
  },
};
