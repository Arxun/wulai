import { useMemo } from 'react';
import * as THREE from 'three';
import FacetMesh from '../../lib/components/FacetMesh';
import { makeGrassGeometry, makeRockGeometry } from '../../lib/geometry/organic';
import { makeMountainRange } from '../../lib/geometry/terrain';
import { applyFaceTint } from '../../lib/geometry/vertexColor';
import { fbm2, ridged2 } from '../../lib/math/noise';
import { urlParam } from '../../lib/hooks/useUrlParams';
import { hash3, mulberry32 } from '../../lib/math/random';

/** 悬崖边缘位于 z=-0.9，再往外塌下去 */
const CLIFF_Z = -0.9;

/** 脚下岩石平台的高度场（草丛、小石头要贴地，所以导出来共用） */
export function groundHeight(x, z) {
  let y = (fbm2(x * 1.7, z * 1.7, { seed: 5, octaves: 3 }) - 0.5) * 0.12 + Math.sin(x * 1.3 + z) * 0.02;
  // 花岗岩板块的裂缝：山脊噪声的“谷”下凹
  const crack = ridged2(x * 0.9, z * 0.9, { seed: 11, octaves: 2 });
  y -= Math.max(0, crack - 0.82) * 0.5;
  if (z < CLIFF_Z) {
    // 右侧是缓坡（照片里右下是红褐色的土坡），左侧和中间是陡崖
    const steep = 0.9 - 0.62 * THREE.MathUtils.smoothstep(x, 0.1, 1.3);
    y -= (CLIFF_Z - z) * steep + (-0.5 + fbm2(x * 0.8, z * 0.8, { seed: 8 })) * (CLIFF_Z - z) * 0.5;
  }
  // 平台四周收边下沉，360° 转到背面 / 侧面时不会露出一块平整的“台面边缘”
  const edge = Math.max(0, Math.abs(x) - 5, z - 5, -z - 3.5);
  y -= edge * edge * 0.6;
  return y;
}

/** 脚下的岩石平台：左侧灰色花岗岩，右侧偏红褐色的土，边缘向悬崖下坡 */
function Ground() {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(18, 16, 90, 80);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 1.5); // z 从 -6.5 到 9.5
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grey = new THREE.Color('#857f77');
    const grey2 = new THREE.Color('#625e59');
    const red = new THREE.Color('#9a5c3e');
    const lichen = new THREE.Color('#8b8a6a');
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, groundHeight(x, z));
      const n = fbm2(x * 2.4, z * 2.4, { seed: 21, octaves: 3 });
      const dirt = THREE.MathUtils.smoothstep(x, 0.1, 1.2) * THREE.MathUtils.smoothstep(z, -2.2, -0.4);
      const crack = ridged2(x * 0.9, z * 0.9, { seed: 11, octaves: 2 });
      tmp.copy(grey).lerp(grey2, n).lerp(red, dirt * (0.5 + n * 0.45));
      // 苔藓斑点 + 裂缝处发暗
      tmp.lerp(lichen, Math.max(0, hash3(Math.floor(x * 5), Math.floor(z * 5), 0, 3) - 0.78) * 1.6);
      tmp.multiplyScalar(1 - Math.max(0, crack - 0.78) * 1.4);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    applyFaceTint(flat, 0.07, 4);
    return flat;
  }, []);

  return <FacetMesh geometry={geom} roughness={1} castShadow={false} />;
}

function Rock({ position, scale, seed, color = '#807d78', squash = 0.8, rotY = 0 }) {
  const geom = useMemo(() => makeRockGeometry(seed, squash, { color }), [seed, squash, color]);
  return <FacetMesh geometry={geom} position={position} scale={scale} rotation={[0, rotY, 0]} roughness={1} />;
}

function Rocks() {
  return (
    <group>
      {/* 悬崖下方的岩壁与大石 */}
      <Rock position={[-2.2, -1.1, -2.3]} scale={[2.0, 1.6, 1.6]} seed={1} color="#6f6d6a" />
      <Rock position={[-0.4, -2.0, -3.0]} scale={[2.6, 2.0, 2.0]} seed={2} color="#7b7976" />
      <Rock position={[1.8, -1.4, -2.6]} scale={[2.0, 1.5, 1.6]} seed={3} color="#85766a" />
      <Rock position={[-4.2, -2.4, -3.5]} scale={[3.2, 2.4, 2.4]} seed={4} color="#66645f" />
      <Rock position={[3.6, -2.4, -3.5]} scale={[3.0, 2.2, 2.2]} seed={5} color="#7d7168" />
      {/* 悬崖边缘的几块岩板（照片里脚下有裂开的花岗岩） */}
      <Rock position={[-1.6, -0.1, -1.3]} scale={[0.9, 0.35, 0.6]} seed={21} color="#8d8982" squash={0.6} rotY={0.4} />
      <Rock position={[0.9, -0.12, -1.35]} scale={[0.8, 0.3, 0.55]} seed={22} color="#948a80" squash={0.6} rotY={-0.3} />
      {/* 脚边的小石头 */}
      <Rock position={[-0.9, 0.02, 0.5]} scale={[0.1, 0.07, 0.09]} seed={6} color="#8b8782" />
      <Rock position={[0.75, 0.02, 0.35]} scale={[0.08, 0.05, 0.07]} seed={7} color="#94867a" />
      <Rock position={[0.3, 0.015, 1.2]} scale={[0.12, 0.06, 0.1]} seed={8} color="#8b8782" />
      <Rock position={[-0.45, 0.012, 0.8]} scale={[0.07, 0.04, 0.06]} seed={9} color="#9a9188" />
    </group>
  );
}

/** 右侧坡上的枯黄 / 褐色草丛（照片右下角） */
function DryGrass() {
  const geom = useMemo(() => {
    const rnd = mulberry32(77);
    const pts = [];
    for (let i = 0; i < 160; i++) {
      const x = 0.4 + rnd() * 2.2;
      const z = -2.4 + rnd() * 3.0;
      pts.push([x, groundHeight(x, z) - 0.01, z]);
    }
    // 左侧石缝里零星几簇
    for (let i = 0; i < 14; i++) {
      const x = -1.8 - rnd() * 0.8;
      const z = -0.9 + rnd() * 1.4;
      pts.push([x, groundHeight(x, z) - 0.01, z]);
    }
    return makeGrassGeometry(pts, { blades: 8, height: 0.17, seed: 5 });
  }, []);
  return <FacetMesh geometry={geom} roughness={0.95} castShadow={false} receiveShadow={false} />;
}

/** 远山：四层山脊，越远越浅，和雾融在一起 */
const RANGES = [
  {
    z: -28, depth: 26, baseY: -12, seed: 1, color: '#27425f', snow: '#506e8e',
    peaks: [{ x: -9.5, h: 33, w: 5.5 }, { x: -3, h: 25, w: 4.5 }, { x: 6, h: 23.7, w: 7 }],
  },
  {
    z: -62, depth: 30, baseY: -12, seed: 2, color: '#40638a', snow: '#7595b6',
    peaks: [{ x: -14, h: 39, w: 8 }, { x: 2, h: 31.5, w: 9 }, { x: 17, h: 35, w: 8 }],
  },
  {
    z: -102, depth: 34, baseY: -14, seed: 3, color: '#5f84a8', snow: '#9cb6cd',
    peaks: [{ x: -30, h: 48, w: 12 }, { x: 8, h: 40, w: 14 }, { x: 42, h: 44, w: 12 }],
  },
  {
    z: -150, depth: 36, baseY: -16, seed: 4, color: '#86a5c0', snow: '#b6c9da',
    peaks: [{ x: -22, h: 52, w: 18 }, { x: 28, h: 49, w: 18 }],
  },
];

function Mountains() {
  const geoms = useMemo(
    () =>
      RANGES.map((r) =>
        makeMountainRange({
          width: 260,
          depth: r.depth,
          segX: 130,
          segZ: 14,
          peaks: r.peaks,
          baseY: r.baseY,
          seed: r.seed,
          color: r.color,
          snowColor: r.snow,
          scale: 0.11,
        }),
      ),
    [],
  );
  return (
    <group>
      {RANGES.map((r, i) => (
        <FacetMesh key={i} geometry={geoms[i]} position={[0, 0, r.z]} tint={r.tint ?? '#909090'} roughness={1} castShadow={false} receiveShadow={false} />
      ))}
    </group>
  );
}

/** 山谷里的云雾：几层半透明的大平面 */
function Mist() {
  if (!urlParam.bool('mist', true)) return null;
  const layers = [
    { z: -14, y: -5, h: 8, o: 0.22 },
    { z: -38, y: -3, h: 10, o: 0.12 },
    { z: -75, y: 0, h: 14, o: 0.1 },
  ];
  return (
    <group>
      {layers.map((l, i) => (
        <mesh key={i} position={[0, l.y, l.z]}>
          <planeGeometry args={[320, l.h]} />
          <meshBasicMaterial color="#e9eff2" transparent opacity={l.o} depthWrite={false} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function Terrain() {
  return (
    <group>
      <Ground />
      <Rocks />
      <DryGrass />
      <Mountains />
      <Mist />
    </group>
  );
}
