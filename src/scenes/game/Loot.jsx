import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import FacetMesh from '../../lib/components/FacetMesh';
import { makeBlobGeometry } from '../../lib/geometry/organic';
import { makeLoftGeometry } from '../../lib/geometry/loft';
import { loot, spawnMapStarterLoot } from './stores/combatStore';
import { terrainHeight } from './maps/huangshan/heightfield';

/**
 * 地上的掉落物：武器缩小立着，药是红/蓝小瓶。
 * 走近约 1.6 米自动捡进背包。
 */

function useLootGeo() {
  return useMemo(
    () => ({
      wood: makeLoftGeometry({
        keys: [
          { p: [0, 0.02, 0], a: 0.018 },
          { p: [0, 0.28, 0], a: 0.016 },
          { p: [0, 0.52, 0], a: 0.012 },
        ],
        samples: 5,
        segments: 6,
        color: '#e4d0a4',
        seed: 701,
      }),
      iron: {
        shaft: makeLoftGeometry({
          keys: [
            { p: [0, 0.02, 0], a: 0.016 },
            { p: [0, 0.34, 0], a: 0.015 },
          ],
          samples: 5,
          segments: 6,
          color: '#4a4e56',
          seed: 702,
        }),
        blade: makeLoftGeometry({
          keys: [
            { p: [0, 0.32, 0], a: 0.01, b: 0.03 },
            { p: [0.02, 0.52, 0], a: 0.004, b: 0.05 },
          ],
          samples: 6,
          segments: 6,
          color: '#c5cdd6',
          seed: 703,
        }),
      },
      frost: {
        shaft: makeLoftGeometry({
          keys: [
            { p: [0, 0.02, 0], a: 0.014 },
            { p: [0, 0.38, 0], a: 0.013 },
          ],
          samples: 5,
          segments: 6,
          color: '#6f8ea8',
          seed: 704,
        }),
        gem: makeBlobGeometry({ radius: 0.07, detail: 1, scale: [0.7, 1.3, 0.7], jitter: 0.1, color: '#b7e7ff', seed: 705 }),
      },
      ember: {
        shaft: makeLoftGeometry({
          keys: [
            { p: [0, 0.02, 0], a: 0.014 },
            { p: [0, 0.4, 0], a: 0.012 },
          ],
          samples: 5,
          segments: 6,
          color: '#3a2218',
          seed: 706,
        }),
        head: makeLoftGeometry({
          keys: [
            { p: [0, 0.38, 0], a: 0.028, b: 0.016 },
            { p: [0, 0.58, 0], a: 0.004, b: 0.004 },
          ],
          samples: 6,
          segments: 6,
          color: '#ff6a22',
          seed: 707,
        }),
      },
      storm: makeLoftGeometry({
        keys: [
          { p: [0, 0.04, 0], a: 0.012, b: 0.028 },
          { p: [0.02, 0.32, 0], a: 0.01, b: 0.036 },
          { p: [0.04, 0.58, 0], a: 0.003, b: 0.01 },
        ],
        samples: 6,
        segments: 6,
        color: '#d2e4ff',
        seed: 708,
      }),
      blood: makeLoftGeometry({
        keys: [
          { p: [0, 0.04, 0], a: 0.012, b: 0.026 },
          { p: [0.01, 0.3, 0], a: 0.01, b: 0.04 },
          { p: [0.02, 0.56, 0], a: 0.003, b: 0.012 },
        ],
        samples: 7,
        segments: 8,
        color: '#c41428',
        capColor: '#ff2040',
        jitter: 0.03,
        seed: 711,
      }),
      bottle: makeLoftGeometry({
        keys: [
          { p: [0, 0.02, 0], a: 0.055 },
          { p: [0, 0.12, 0], a: 0.062 },
          { p: [0, 0.2, 0], a: 0.04 },
          { p: [0, 0.26, 0], a: 0.022 },
        ],
        samples: 6,
        segments: 8,
        color: '#e8e4dc',
        seed: 709,
      }),
      cork: makeBlobGeometry({ radius: 0.028, detail: 0, scale: [1, 0.7, 1], jitter: 0.04, color: '#6a4a28', seed: 710 }),
    }),
    [],
  );
}

function LootMesh({ id, geo }) {
  if (id === 'wood') return <FacetMesh geometry={geo.wood} roughness={0.7} />;
  if (id === 'iron') {
    return (
      <group>
        <FacetMesh geometry={geo.iron.shaft} roughness={0.4} metalness={0.4} />
        <FacetMesh geometry={geo.iron.blade} roughness={0.25} metalness={0.7} />
      </group>
    );
  }
  if (id === 'frost') {
    return (
      <group>
        <FacetMesh geometry={geo.frost.shaft} roughness={0.35} metalness={0.25} />
        <FacetMesh geometry={geo.frost.gem} position={[0, 0.44, 0]} roughness={0.15} metalness={0.4} />
        <pointLight position={[0, 0.46, 0]} color="#9ad8ff" intensity={1.2} distance={2.2} />
      </group>
    );
  }
  if (id === 'ember') {
    return (
      <group>
        <FacetMesh geometry={geo.ember.shaft} roughness={0.7} />
        <FacetMesh geometry={geo.ember.head} roughness={0.25} />
        <pointLight position={[0, 0.5, 0]} color="#ff7a2a" intensity={1.6} distance={2.4} />
      </group>
    );
  }
  if (id === 'storm') {
    return (
      <group>
        <FacetMesh geometry={geo.storm} roughness={0.12} metalness={0.85} />
        <pointLight position={[0, 0.36, 0]} color="#9ecbff" intensity={1.3} distance={2.2} />
      </group>
    );
  }
  if (id === 'blood') {
    return (
      <group>
        <FacetMesh geometry={geo.blood} roughness={0.45} metalness={0.75} />
        <pointLight position={[0, 0.32, 0]} color="#ff2040" intensity={1.5} distance={2.2} />
      </group>
    );
  }
  const potion = id === 'mp';
  const tint = potion ? '#3d8adf' : '#d63a32';
  const glow = potion ? '#7ecbff' : '#ff6a55';
  return (
    <group>
      <FacetMesh geometry={geo.bottle} roughness={0.25} metalness={0.15} tint={tint} />
      <FacetMesh geometry={geo.cork} position={[0, 0.275, 0]} roughness={0.9} />
      <pointLight position={[0, 0.16, 0]} color={glow} intensity={1.1} distance={1.8} />
    </group>
  );
}

function LootItem({ item, geo }) {
  const group = useRef();
  const ring = item.id === 'hp' ? '#ff6a55' : item.id === 'mp' ? '#6cb6ff' : '#ffd166';

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const y = terrainHeight(item.x, item.z);
    g.position.set(item.x, y + 0.08 + Math.sin(t * 2.6 + item.spin) * 0.06, item.z);
    g.rotation.y = item.spin + t * 1.4;
  });

  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.18, 0.28, 20]} />
        <meshBasicMaterial color={ring} transparent opacity={0.72} side={THREE.DoubleSide} />
      </mesh>
      <LootMesh id={item.id} geo={geo} />
    </group>
  );
}

export default function Loot() {
  const geo = useLootGeo();
  const [list, setList] = useState([]);
  useEffect(() => {
    spawnMapStarterLoot();
    const id = setInterval(() => setList(loot.slice()), 120);
    return () => clearInterval(id);
  }, []);
  return (
    <group>
      {list.map((it) => (
        <LootItem key={it.uid} item={it} geo={geo} />
      ))}
    </group>
  );
}
