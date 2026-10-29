import { Suspense, useEffect, useRef, useState } from 'react';
import GameEnvironment from './GameEnvironment';
import Su7LoadingPlaceholder from './vehicles/su7/Su7LoadingPlaceholder';
import { Su7CarPlacement } from './vehicles';
import { runWhenIdle } from './lib/runWhenIdle';
import { getGameLoadingState, subscribeGameLoading } from './stores/gameLoadingStore';

/**
 * 进图后在 idle 里挂上：环境光 → SU7。
 * 文件在进图时已经低优先级预取，这里只负责解码和上传，不挡进游戏。
 */
export default function IdleDeferredLoad() {
  const [tier, setTier] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const start = () => {
      if (cancelled || started.current) return;
      started.current = true;
      void (async () => {
        await runWhenIdle(() => {}, { timeout: 180 });
        if (cancelled) return;
        setTier(1);
        await runWhenIdle(() => {}, { timeout: 420 });
        if (cancelled) return;
        setTier(2);
      })();
    };

    const st = getGameLoadingState();
    if (st.phase === 'hidden' || st.phase === 'enter') start();

    const unsub = subscribeGameLoading(() => {
      const s = getGameLoadingState();
      if (s.phase === 'enter' || s.phase === 'hidden') start();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (tier < 1) return null;

  return (
    <>
      <Suspense fallback={null}>
        <GameEnvironment />
      </Suspense>
      {tier >= 2 && (
        <Suspense fallback={<Su7LoadingPlaceholder />}>
          <Su7CarPlacement />
        </Suspense>
      )}
    </>
  );
}
