import { useLayoutEffect } from 'react';
import { markSkillFxWarmupRoot } from './warmupShaders';

/** 挂在技能 FX 根 group 的 ref 上，供 warmup 遍历 */
export function useSkillFxWarmupRoot(ref) {
  useLayoutEffect(() => {
    markSkillFxWarmupRoot(ref.current);
  });
}
