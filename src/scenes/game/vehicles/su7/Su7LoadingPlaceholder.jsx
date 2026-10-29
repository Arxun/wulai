import { Html, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SU7_SPAWN } from '../../maps/huangshan/obstacles';
import { terrainHeight } from '../../maps/huangshan/heightfield';

const GHOST = new THREE.Color('#aeb6c0');

function useGhostMaterials() {
  return useMemo(
    () => ({
      hull: new THREE.MeshBasicMaterial({
        color: GHOST,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        toneMapped: false,
      }),
      cabin: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#c4cad2'),
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        toneMapped: false,
      }),
      glass: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#e8ecf0'),
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        toneMapped: false,
      }),
      wheel: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#8a929c'),
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        toneMapped: false,
      }),
      halo: new THREE.MeshBasicMaterial({
        color: GHOST,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    }),
    [],
  );
}

/** SU7 glTF 未就绪时的占位（Suspense fallback） */
export default function Su7LoadingPlaceholder() {
  const { x, z, rotationY, sink } = SU7_SPAWN;
  const y = terrainHeight(x, z) - sink;
  const mats = useGhostMaterials();
  const pulse = useRef({ hull: 0.38, cabin: 0.22, halo: 0.14 });

  useFrame(({ clock }) => {
    const w = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 2.4);
    pulse.current.hull = 0.32 + w * 0.14;
    pulse.current.cabin = 0.16 + w * 0.1;
    pulse.current.halo = 0.1 + w * 0.08;
    mats.hull.opacity = pulse.current.hull;
    mats.cabin.opacity = pulse.current.cabin;
    mats.halo.opacity = pulse.current.halo;
  });

  const wheels = useMemo(
    () => [
      [-0.78, 0.2, 1.42],
      [0.78, 0.2, 1.42],
      [-0.78, 0.2, -1.42],
      [0.78, 0.2, -1.42],
    ],
    [],
  );

  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={mats.halo}>
        <ringGeometry args={[1.05, 2.35, 48]} />
      </mesh>

      <RoundedBox args={[2.02, 0.26, 4.35]} radius={0.1} smoothness={4} position={[0, 0.24, 0]} material={mats.hull} />
      <RoundedBox args={[1.72, 0.34, 2.05]} radius={0.08} smoothness={4} position={[0, 0.48, -0.42]} material={mats.cabin} />
      <RoundedBox args={[1.55, 0.14, 1.05]} radius={0.05} smoothness={3} position={[0, 0.52, 0.72]} material={mats.cabin} />
      <RoundedBox args={[1.58, 0.32, 0.06]} radius={0.02} smoothness={2} position={[0, 0.58, 0.18]} material={mats.glass} />

      {wheels.map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, Math.PI / 2]} material={mats.wheel}>
          <torusGeometry args={[0.3, 0.07, 12, 24]} />
        </mesh>
      ))}

      <Html center position={[0, 1.28, 0]} distanceFactor={14} zIndexRange={[20, 0]}>
        <div className="su7-loading-tag">
          <svg className="su7-loading-icon" viewBox="0 0 48 24" aria-hidden>
            <defs>
              <linearGradient id="su7GhostGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(220, 226, 232, 0.95)" />
                <stop offset="100%" stopColor="rgba(140, 148, 158, 0.55)" />
              </linearGradient>
            </defs>
            <path
              fill="url(#su7GhostGrad)"
              d="M6 14.5h2.2l1.2-3.2h8.8l1.3 3.2H22l-1.4-4.2c-.3-.9-1.1-1.5-2-1.5H11.4c-.9 0-1.7.6-2 1.5L6 14.5zm4.8-5.2h6.4l.9-2.1H9.9l.9 2.1zM8 16.5a2 2 0 1 0 0 .01h32a2 2 0 1 0 0-.01H8zm4.5 0a1.6 1.6 0 1 1 3.2 0 1.6 1.6 0 0 1-3.2 0zm19.8 0a1.6 1.6 0 1 1 3.2 0 1.6 1.6 0 0 1-3.2 0z"
            />
          </svg>
          <span>正在加载载具…</span>
        </div>
      </Html>
    </group>
  );
}
