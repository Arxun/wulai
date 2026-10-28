import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { terrainHeight } from '../maps/huangshan/heightfield';
import { combat } from '../stores/combatStore';

/** 死亡倒地处的血迹（单处，随 deathStain 更新） */
export default function BloodStain() {
  const mesh = useRef();
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#5c0a10',
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -5,
        polygonOffsetUnits: -5,
      }),
    [],
  );

  useFrame((_, dt) => {
    const stain = combat.deathStain;
    const m = mesh.current;
    if (!m || !stain) {
      if (m) m.visible = false;
      return;
    }
    stain.age += dt;
    m.visible = true;
    const y = terrainHeight(stain.x, stain.z) + 0.038;
    m.position.set(stain.x, y, stain.z);
    const grow = Math.min(1, stain.age / 0.4);
    const s = 0.28 + grow * 0.62;
    m.scale.set(s * 1.05, 1, s * 0.88);
    const fadeIn = Math.min(1, stain.age / 0.15);
    const fadeOut =
      stain.age > 2.1 ? Math.max(0, 1 - (stain.age - 2.1) / 0.9) : 1;
    mat.opacity = 0.78 * fadeIn * fadeOut;
  });

  return (
    <mesh ref={mesh} visible={false} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={2}>
      <circleGeometry args={[1, 28]} />
    </mesh>
  );
}
