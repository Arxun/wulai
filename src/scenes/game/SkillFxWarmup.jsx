import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { GAME_PERF } from './config/perf';
import { countSkillFxWarmupRoots, warmupSkillFxShaders } from './debug/warmupShaders';
import {
  completeGameLoadWarmup,
  getGameLoadingState,
  markGameLoadWarmupStarted,
} from './stores/gameLoadingStore';

/** 首屏遮罩期间预热技能/连招特效着色器，避免移动端第一次放技能卡顿 */
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
    const assetsReady = load.assetsReady || (!load.assetsActive && load.progress >= 100);
    if (frames.current < GAME_PERF.skillWarmupAfterFrames) return;
    if (!assetsReady && frames.current < 90) return;

    const roots = countSkillFxWarmupRoots(scene);
    if (roots < 4 && frames.current < GAME_PERF.skillWarmupMaxFrames) return;

    running.current = true;
    if (!startedHint.current) {
      startedHint.current = true;
      markGameLoadWarmupStarted();
    }

    const run = async () => {
      try {
        const n = await warmupSkillFxShaders(gl, scene, camera, {
          fullScene: GAME_PERF.skillWarmupFullScene,
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
