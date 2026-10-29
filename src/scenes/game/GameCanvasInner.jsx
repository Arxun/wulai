import { Suspense, useLayoutEffect } from 'react';
import GameLoadReporter from './GameLoadReporter';
import GameScene from './GameScene';
import MobileCanvasResize from './mobile/MobileCanvasResize';
import { markGameLoadCriticalReady } from './stores/gameLoadingStore';

/** 武来 Canvas 内层（lazy 整块加载，与 lowpoly 分离） */
export default function GameCanvasInner({ mobileLayoutSync = false }) {
  useLayoutEffect(() => {
    markGameLoadCriticalReady();
  }, []);

  return (
    <>
      {mobileLayoutSync && <MobileCanvasResize />}
      <GameLoadReporter />
      <Suspense fallback={null}>
        <GameScene />
      </Suspense>
    </>
  );
}
