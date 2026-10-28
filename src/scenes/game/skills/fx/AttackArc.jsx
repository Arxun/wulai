import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HEAVY_RANGE, HIT_RANGE, world } from '../../stores/combatStore';

/**
 * 挥击时脚底下的扇形——就是攻击判定范围。
 * 浅色 = J 轻击近距离窄扇，金色 = K 重击大扇。
 */

export default function AttackArc() {
  const light = useRef();
  const heavy = useRef();
  const gJ = useMemo(() => new THREE.RingGeometry(0.45, HIT_RANGE, 28, 1, Math.PI / 2 - 0.85, 1.7), []);
  const gK = useMemo(() => new THREE.RingGeometry(0.4, HEAVY_RANGE, 32, 1, Math.PI / 2 - 1.45, 2.9), []);

  useFrame(() => {
    const j = world.swing > 0;
    if (light.current) {
      light.current.visible = j;
      if (j) light.current.material.opacity = world.striking ? 0.55 : 0.22;
    }
    // K 的地面范围交给 HeavySkillFx 的冲击波，这里不再叠一块黄扇
    if (heavy.current) heavy.current.visible = false;
  });

  return (
    <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <mesh ref={light} geometry={gJ} visible={false}>
        <meshBasicMaterial color="#fff4d2" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={heavy} geometry={gK} visible={false}>
        <meshBasicMaterial color="#ffb84a" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
