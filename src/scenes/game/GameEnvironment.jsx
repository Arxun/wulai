import { Environment, Lightformer } from '@react-three/drei';
import { GAME_PERF } from './config/perf';

/** 环境光单独 Suspense，避免阻塞首帧地形/玩家 */
export default function GameEnvironment() {
  return (
    <Environment resolution={GAME_PERF.environmentResolution} frames={1} environmentIntensity={0.5}>
      <Lightformer form="rect" intensity={2} color="#f2f7fb" position={[0, 10, 4]} rotation-x={Math.PI / 2} scale={[20, 12, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#9a8c76" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} />
    </Environment>
  );
}
