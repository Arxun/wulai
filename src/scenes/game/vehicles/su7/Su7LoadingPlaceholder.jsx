import { Html } from '@react-three/drei';
import { SU7_SPAWN } from '../../maps/huangshan/obstacles';
import { terrainHeight } from '../../maps/huangshan/heightfield';

/** SU7 glTF 未就绪时的占位（Suspense fallback） */
export default function Su7LoadingPlaceholder() {
  const { x, z, rotationY, sink } = SU7_SPAWN;
  const y = terrainHeight(x, z) - sink;

  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.85, 0.42, 4.2]} />
        <meshStandardMaterial color="#3a4858" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.58, -0.35]} castShadow>
        <boxGeometry args={[1.55, 0.38, 1.85]} />
        <meshStandardMaterial color="#4a5a6a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.52, 0.95]}>
        <boxGeometry args={[1.62, 0.12, 0.08]} />
        <meshStandardMaterial color="#7ec8e8" roughness={0.3} metalness={0.2} emissive="#2a6080" emissiveIntensity={0.35} />
      </mesh>
      {[
        [-0.72, 0.18, 1.35],
        [0.72, 0.18, 1.35],
        [-0.72, 0.18, -1.35],
        [0.72, 0.18, -1.35],
      ].map((p, i) => (
        <mesh key={i} position={p} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.14, 10]} />
          <meshStandardMaterial color="#1a1e24" roughness={0.9} />
        </mesh>
      ))}
      <Html center position={[0, 1.35, 0]} distanceFactor={14} zIndexRange={[20, 0]}>
        <div className="su7-loading-tag">正在加载载具…</div>
      </Html>
    </group>
  );
}
