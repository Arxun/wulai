import { useLayoutEffect } from 'react';
import { markSkillFxWarmupRoot } from './warmupShaders';

/** 挂在技能 FX 根 group 的 ref 上，供 warmup 遍历；tier `ult` 会多跑一轮大招专用预热 */
export function useSkillFxWarmupRoot(ref, options) {
  useLayoutEffect(() => {
    markSkillFxWarmupRoot(ref.current, options);
  });
}
