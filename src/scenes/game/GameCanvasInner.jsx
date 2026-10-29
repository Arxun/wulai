import { Suspense, useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import GameLoadReporter from './GameLoadReporter';
import GameScene from './GameScene';
import { releaseSceneGpu } from './lib/releaseSceneGpu';
import MobileCanvasResize from './mobile/MobileCanvasResize';
import { noteGameLoadStage } from './stores/gameLoadingStore';

/** 武来 Canvas 内层（lazy 整块加载，与 lowpoly 分离） */
export default function GameCanvasInner({ mobileLayoutSync = false }) {
  const scene = useThree((s) => s.scene);

  useLayoutEffect(() => {
    noteGameLoadStage('canvas');
  }, []);

  // 必须是 layout 清理：此时子树的 three 对象还没被摘下，遍历得到完整场景
  useLayoutEffect(() => () => releaseSceneGpu(scene), [scene]);

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
