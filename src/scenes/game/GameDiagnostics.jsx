import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { attachWulaiErrorHandlers, logWulaiBootChecks } from './debug/reportError';
import { combat, world } from './stores/combatStore';
import { vehicle } from './vehicles/runtime';

/** 不占画面；挂全局错误监听 + 启动自检 */
export default function GameDiagnostics() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    logWulaiBootChecks({ vehicle, world, combat });
    return attachWulaiErrorHandlers(gl);
  }, [gl]);

  return null;
}
