import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { GAME_PERF } from './config/perf';
import { warmupSkillFxShaders } from './debug/warmupShaders';

/** 进图数帧后在 idle 窗口预热技能特效着色器 */
export default function SkillFxWarmup() {
  const { gl, scene, camera } = useThree();
  const done = useRef(false);
  const frames = useRef(0);

  useFrame(() => {
    if (done.current) return;
    frames.current += 1;
    if (frames.current < GAME_PERF.skillWarmupAfterFrames) return;
    done.current = true;

    const run = async () => {
      try {
        const n = await warmupSkillFxShaders(gl, scene, camera);
        if (n > 0) console.info('[武来·warmup] 技能着色器已预热', { roots: n });
      } catch (err) {
        console.warn('[武来·warmup] 预热失败（可忽略，首次放技能仍可能略卡）', err);
      }
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        run();
      }, { timeout: 1200 });
    } else {
      setTimeout(run, 50);
    }
  });

  return null;
}
