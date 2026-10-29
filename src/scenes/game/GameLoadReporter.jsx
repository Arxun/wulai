import { useProgress } from '@react-three/drei';
import { useEffect } from 'react';
import { updateGameLoadAssets } from './stores/gameLoadingStore';

/** 在 Canvas 内订阅 drei 全局加载进度（勿在 render 里 useProgress，避免 Su7Car 等加载时交叉更新） */
export default function GameLoadReporter() {
  useEffect(() => {
    let raf = 0;
    const push = (s) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        updateGameLoadAssets({
          active: s.active,
          progress: s.progress,
          loaded: s.loaded,
          total: s.total,
        });
      });
    };
    const unsub = useProgress.subscribe(push);
    push(useProgress.getState());
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, []);

  return null;
}
