import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { fabricTextures } from '../../../lib/textures/procedural';
import { C } from './palette';

/**
 * 身上的非武器装备：斜挎黑包 + 肩带。
 * 武器在右手 WeaponSlot，见 scenes/game/weapons.jsx。
 */

/** 背包带：两点之间的一条扁带子 */
function Strap({ from, to, width = 0.04, color = C.bag }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      length: dir.length(),
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <boxGeometry args={[width, length, 0.014]} />
      <meshStandardMaterial color={color} roughness={0.85} flatShading />
    </mesh>
  );
}

/** 背包：圆角方体 + 拉链 + 侧袋 */
function Bag() {
  const tex = useMemo(() => fabricTextures('canvas'), []);
  return (
    <group position={[0.27, 0.9, 0.02]} rotation={[0.04, -0.08, -0.05]}>
      <RoundedBox args={[0.11, 0.34, 0.2]} radius={0.03} smoothness={1} castShadow receiveShadow>
        <meshStandardMaterial color={C.bag} roughness={0.8} flatShading map={tex.map} bumpMap={tex.bump} bumpScale={1} />
      </RoundedBox>
      {/* 顶部拉链 + 拉头 */}
      <mesh position={[0, 0.165, 0]} castShadow={false}>
        <boxGeometry args={[0.114, 0.012, 0.17]} />
        <meshStandardMaterial color={C.bagLight} roughness={0.7} flatShading />
      </mesh>
      {/* 外侧口袋 */}
      <RoundedBox args={[0.02, 0.15, 0.15]} radius={0.008} smoothness={1} position={[0.058, -0.05, 0]} castShadow>
        <meshStandardMaterial color={C.bagLight} roughness={0.8} flatShading />
      </RoundedBox>
    </group>
  );
}

export default function Gear() {
  return (
    <group>
      <Bag />
      {/* 肩带：从右肩跨过胸口落到背包 */}
      <Strap from={[0.17, 1.4, 0.1]} to={[0.205, 1.2, 0.19]} />
      <Strap from={[0.215, 1.43, -0.02]} to={[0.31, 1.07, 0.04]} width={0.045} />
    </group>
  );
}
