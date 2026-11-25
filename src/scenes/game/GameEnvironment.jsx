import { Environment, Lightformer } from '@react-three/drei';
import { getGamePerf } from './config/perf';

/** 环境光单独 Suspense，避免阻塞首帧地形/玩家 */
export default function GameEnvironment() {
  const res = getGamePerf().environmentResolution;
  return (
    <Environment resolution={res} frames={1} environmentIntensity={0.5}>
      <Lightformer form="rect" intensity={2} color="#f2f7fb" position={[0, 10, 4]} rotation-x={Math.PI / 2} scale={[20, 12, 1]} />
      <Lightformer form="rect" intensity={1.05} color="#e4eef6" position={[-16, 5, 8]} rotation-y={Math.PI / 2} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#d5e2ee" position={[16, 4, 2]} rotation-y={-Math.PI / 2} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#9a8c76" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} />
    </Environment>
  );
}
