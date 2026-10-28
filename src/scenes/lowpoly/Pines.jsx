import { useMemo } from 'react';
import Log from './Log';
import FacetMesh from '../../lib/components/FacetMesh';
import { makeBlobGeometry, makeNeedlePadGeometry } from '../../lib/geometry/organic';
import { mulberry32 } from '../../lib/math/random';

/**
 * 黄山松：一簇簇放射状的松针（Pad）+ 弯曲的枝干。
 * 照片里有：头顶右侧斜伸过来的主枝、左上角一簇、栏杆后面左右两丛。
 */
const PALETTES = [
  { base: '#4a6a33', tip: '#a8c86e' },
  { base: '#557538', tip: '#b4d278' },
  { base: '#405d2e', tip: '#94b862' },
];

function NeedlePad({ position, scale = 1, seed = 1, tone = 0 }) {
  const geom = useMemo(() => makeNeedlePadGeometry(seed, 120, 0.25, PALETTES[(seed + tone) % PALETTES.length]), [seed, tone]);
  const core = useMemo(() => makeBlobGeometry({ radius: 0.09, detail: 1, scale: [1, 0.55, 1], jitter: 0.12, color: '#4d6633', seed }), [seed]);
  const rot = useMemo(() => {
    const r = mulberry32(seed * 7 + 3);
    return [r() * 0.5, r() * Math.PI * 2, r() * 0.5];
  }, [seed]);
  return (
    <group position={position} scale={scale} rotation={rot}>
      <FacetMesh geometry={geom} roughness={0.8} side={2} />
      {/* 中心实心，避免透出背景 */}
      <FacetMesh geometry={core} roughness={0.9} castShadow={false} />
    </group>
  );
}

/** 枝干：按点列依次连接，半径逐段变细 */
function Branch({ points, radii, seed = 1, color = '#4a3b2f' }) {
  return (
    <group>
      {points.slice(0, -1).map((p, i) => (
        <Log
          key={i}
          from={p}
          to={points[i + 1]}
          radius={radii[i]}
          taper={radii[i + 1] / radii[i]}
          wobble={0.012}
          seed={seed + i}
          color={color}
        />
      ))}
    </group>
  );
}

export default function Pines() {
  return (
    <group>
      {/* 头顶右侧的主枝：从右上方斜伸到头后 */}
      <Branch
        seed={100}
        points={[
          [1.4, 2.25, -0.9],
          [0.8, 2.02, -0.9],
          [0.5, 1.8, -0.9],
          [0.25, 1.68, -0.92],
          [0, 1.64, -0.95],
          [-0.26, 1.62, -0.95],
        ]}
        radii={[0.075, 0.065, 0.052, 0.04, 0.03, 0.02]}
      />
      {/* 右上一大簇 + 沿枝几簇 */}
      <NeedlePad position={[0.62, 2.0, -0.88]} scale={0.95} seed={1} />
      <NeedlePad position={[0.9, 2.1, -0.9]} scale={0.8} seed={2} tone={1} />
      <NeedlePad position={[0.36, 1.78, -0.95]} scale={0.7} seed={3} />
      {/* 头左侧的一大簇（照片里头后面左边的尖刺） */}
      <NeedlePad position={[-0.42, 1.68, -0.98]} scale={0.95} seed={4} tone={1} />
      <NeedlePad position={[-0.6, 1.5, -1.0]} scale={0.8} seed={5} />
      <NeedlePad position={[0.8, 1.7, -0.92]} scale={0.6} seed={6} tone={1} />

      {/* 左上角的一簇 + 一小段树枝 */}
      <Branch
        seed={120}
        points={[
          [-1.6, 2.7, -0.9],
          [-1.1, 2.5, -0.9],
          [-0.78, 2.33, -0.92],
        ]}
        radii={[0.05, 0.04, 0.03]}
      />
      <NeedlePad position={[-0.78, 2.34, -0.9]} scale={1.15} seed={7} tone={1} />
      <NeedlePad position={[-1.0, 2.5, -0.92]} scale={1.0} seed={8} />

      {/* 栏杆后面左右两丛松针（远处灌木感） */}
      <NeedlePad position={[0.78, 1.05, -1.15]} scale={1.5} seed={9} />
      <NeedlePad position={[0.55, 0.88, -1.2]} scale={1.3} seed={10} tone={1} />
      <NeedlePad position={[-0.78, 1.0, -1.15]} scale={1.5} seed={11} tone={1} />
      <NeedlePad position={[-0.98, 0.84, -1.2]} scale={1.3} seed={12} />
      {/* 栏杆下方崖壁上冒出来的灌木 */}
      <NeedlePad position={[-0.62, 0.36, -1.0]} scale={1.25} seed={15} />
      <NeedlePad position={[-0.3, 0.12, -1.2]} scale={1.1} seed={16} tone={1} />
      <NeedlePad position={[0.78, 0.42, -1.05]} scale={1.2} seed={17} tone={1} />
      <NeedlePad position={[1.05, 0.25, -1.15]} scale={1.1} seed={18} />
      <NeedlePad position={[1.2, 0.95, -1.3]} scale={1.5} seed={13} tone={1} />
      <NeedlePad position={[-1.3, 0.95, -1.3]} scale={1.5} seed={14} />
    </group>
  );
}
