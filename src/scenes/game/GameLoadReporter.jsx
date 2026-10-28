import { useProgress } from '@react-three/drei';
import { useEffect } from 'react';
import { updateGameLoadAssets } from './stores/gameLoadingStore';

/** 在 Canvas 内订阅 drei 全局加载进度 */
export default function GameLoadReporter() {
  const { active, progress, loaded, total } = useProgress();

  useEffect(() => {
    updateGameLoadAssets({ active, progress, loaded, total });
  }, [active, progress, loaded, total]);

  return null;
}
