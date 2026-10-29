import { Suspense, useEffect, useRef, useState } from 'react';
import GameEnvironment from './GameEnvironment';
import Su7LoadingPlaceholder from './vehicles/su7/Su7LoadingPlaceholder';
import { Su7CarPlacement } from './vehicles';
import { runWhenIdle } from './lib/runWhenIdle';
import { getGameLoadingState, subscribeGameLoading } from './stores/gameLoadingStore';

/**
 * 进图后在 idle 里分批加载：环境光 → SU7（约 3MB）。
 * 不阻塞首屏遮罩关闭。
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
        await runWhenIdle(() => {}, { timeout: 400 });
        if (cancelled) return;
        setTier(1);
        await runWhenIdle(() => {}, { timeout: 900 });
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
