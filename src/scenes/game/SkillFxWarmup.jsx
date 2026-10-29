import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { getGamePerf, isGamePerfMobile } from './config/perf';
import { runWhenIdle } from './lib/runWhenIdle';
import { countSkillFxWarmupRoots, warmupSkillFxShaders } from './debug/warmupShaders';
import {
  completeGameLoadWarmup,
  getGameLoadingState,
  markGameLoadWarmupStarted,
} from './stores/gameLoadingStore';

/** 进图后在 idle 预热技能着色器，不挡首屏 */
export default function SkillFxWarmup() {
  const { gl, scene, camera } = useThree();
  const done = useRef(false);
  const running = useRef(false);
  const frames = useRef(0);
  const startedHint = useRef(false);

  useFrame(() => {
    if (done.current || running.current) return;
    frames.current += 1;

    const load = getGameLoadingState();
    if (load.phase === 'loading' && load.show) return;

    const perf = getGamePerf();
    const mobile = isGamePerfMobile();
    const minFrames = mobile ? perf.skillWarmupAfterFramesMobile : perf.skillWarmupAfterFrames;
    if (frames.current < minFrames) return;

    const roots = countSkillFxWarmupRoots(scene);
    const maxWait = mobile ? 45 : 24;
    if (roots < 1 && frames.current < maxWait) return;

    running.current = true;
    if (perf.gateLoadingOnSkillWarmup && !startedHint.current) {
      startedHint.current = true;
      markGameLoadWarmupStarted();
    }

    const run = async () => {
      const idleMs = mobile ? perf.skillWarmupIdleTimeoutMsMobile : perf.skillWarmupIdleTimeoutMs;
      if (idleMs > 0) {
        await runWhenIdle(() => {}, { timeout: idleMs });
      }
      try {
        const n = await warmupSkillFxShaders(gl, scene, camera, {
          fullScene: perf.skillWarmupFullScene,
        });
        if (n > 0 && import.meta.env.DEV) {
          console.info('[武来·warmup] 技能着色器已预热', { roots: n });
        }
      } catch (err) {
        console.warn('[武来·warmup] 预热失败（可忽略）', err);
      } finally {
        completeGameLoadWarmup();
        done.current = true;
        running.current = false;
      }
    };

    void run();
  });

  return null;
}
