import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { runWhenIdle } from './lib/runWhenIdle';
import { getGameLoadingState, subscribeGameLoading } from './stores/gameLoadingStore';

const GameEnvironment = lazy(() => import('./GameEnvironment'));
const Su7Block = lazy(() => import('./vehicles/su7/Su7Deferred'));

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
        <Suspense fallback={null}>
          <Su7Block />
        </Suspense>
      )}
    </>
  );
}
