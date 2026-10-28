import { SU7_VEHICLE } from './su7/def';

/**
 * 载具静态配置。不同载具 speedMult 不同，由 runtime 读取。
 */
export const VEHICLE_DEFS = {
  [SU7_VEHICLE.id]: SU7_VEHICLE,
};

export const DEFAULT_VEHICLE_ID = SU7_VEHICLE.id;
