import { useMemo } from 'react';
import FacetMesh from '../../../lib/components/FacetMesh';
import { makeBlobGeometry } from '../../../lib/geometry/organic';
import { makeLoftGeometry } from '../../../lib/geometry/loft';
import { fabricTextures } from '../../../lib/textures/procedural';
import { C } from './palette';

/**
 * 躯干网格（小武外套）。自己不摆姿势——Person 把 lean / twist / roll 加在骨盆组上，
 * 整件上身跟着转，头和手臂是它的子节点，腿在骨盆外不受影响。
 */
const CX = -0.02;
const HALF_PI = Math.PI / 2;

/** 沿 y 的躯干截面（各层半宽 a / 半厚 b） */
const bodyKeys = (ys, a, b) => ys.map((y, i) => ({ p: [CX, y, 0], a: a[i], b: b[i] }));

/** 把贴在外套表面的小零件（口袋、拉链）放到椭圆截面上：返回 position / rotationY */
function onJacket(side, localX, y, a = 0.236, b = 0.164) {
  const x = localX * side;
  const c = Math.max(-0.98, Math.min(0.98, x / a));
  const z = b * Math.sqrt(1 - c * c);
  // 椭圆法线与 +Z 的夹角
  const rotY = Math.atan2(x / (a * a), z / (b * b));
  return { position: [CX + x, y, z + 0.034], rotation: [0, rotY, 0] };
}

export default function Torso() {
  const tex = useMemo(
    () => ({ jacket: fabricTextures('ripstop'), shirt: fabricTextures('chambray'), tee: fabricTextures('jersey') }),
    [],
  );
  const geo = useMemo(() => {
    // ---- 外套：开口壳体 + 羽绒服绗缝鼓包 ----
    const jacket = makeLoftGeometry({
      keys: bodyKeys(
        [0.66, 0.8, 1.02, 1.22, 1.33, 1.4],
        [0.228, 0.236, 0.232, 0.228, 0.205, 0.15],
        [0.158, 0.164, 0.162, 0.152, 0.132, 0.112],
      ),
      samples: 15,
      segments: 14,
      gap: { center: HALF_PI, half: 0.4 },
      thickness: 0.04,
      bumps: { count: 7, amount: 0.032, phase: 0.25 },
      jitter: 0.012,
      // 下摆松紧边颜色更深
      color: (t) => (t < 0.045 ? C.jacketDark : C.jacket),
      innerColor: C.lining,
      rimColor: C.lining,
      faceTint: 0.045,
      uvMeters: 0.07,
      seed: 3,
    });

    // ---- 衬衫：V 领，从胸口往上逐渐敞开 ----
    const shirt = makeLoftGeometry({
      keys: bodyKeys([0.68, 0.9, 1.2, 1.36, 1.43], [0.188, 0.19, 0.19, 0.16, 0.1], [0.128, 0.13, 0.126, 0.114, 0.09]),
      samples: 9,
      segments: 12,
      gap: { center: HALF_PI, half: (t) => (t < 0.58 ? 0 : ((t - 0.58) / 0.42) * 0.46) },
      thickness: 0.014,
      color: C.shirt,
      innerColor: C.shirtDark,
      rimColor: C.shirt,
      faceTint: 0.05,
      uvMeters: 0.06,
      seed: 5,
    });

    // ---- 白 T 恤：下摆露在衬衫下面一圈，领口露在 V 领里 ----
    const tee = makeLoftGeometry({
      // 只有下摆比衬衫宽一圈（露出白边），胸口比衬衫小，才能从 V 领里露出来
      keys: bodyKeys(
        [0.6, 0.69, 0.76, 1.2, 1.38, 1.45],
        [0.196, 0.196, 0.166, 0.168, 0.14, 0.09],
        [0.14, 0.14, 0.112, 0.112, 0.1, 0.082],
      ),
      samples: 9,
      segments: 12,
      color: C.tee,
      faceTint: 0.03,
      uvMeters: 0.05,
      seed: 7,
    });

    // ---- 立领：略微外翻的深色圈，前面开口 ----
    const collar = makeLoftGeometry({
      keys: [
        { p: [0, 1.35, -0.004], a: 0.14, b: 0.12 },
        { p: [0, 1.42, -0.01], a: 0.124, b: 0.108 },
        { p: [0, 1.472, -0.016], a: 0.128, b: 0.112 },
      ],
      samples: 5,
      segments: 12,
      gap: { center: HALF_PI, half: 0.78 },
      thickness: 0.03,
      color: C.collar,
      innerColor: '#2a3043',
      rimColor: C.collar,
      jitter: 0.015,
      faceTint: 0.05,
      seed: 9,
    });

    // ---- 衬衫翻领：左右两片小三角 ----
    const collarFlap = makeBlobGeometry({ radius: 0.03, detail: 0, scale: [1.1, 1.4, 0.3], jitter: 0.04, color: C.shirt, seed: 11 });
    // ---- 帽子（卷在后颈的兜帽） ----
    const hood = makeBlobGeometry({ radius: 0.1, detail: 1, scale: [1.25, 0.6, 0.75], jitter: 0.1, color: C.collar, seed: 13 });
    return { jacket, shirt, tee, collar, collarFlap, hood };
  }, []);

  // 口袋 / 拉链：左右对称
  const sides = [-1, 1];
  return (
    <group>
      <FacetMesh geometry={geo.tee} side={2} texture={tex.tee} bumpScale={0.6} />
      <FacetMesh geometry={geo.shirt} side={2} texture={tex.shirt} bumpScale={0.8} />
      <FacetMesh geometry={geo.jacket} side={2} roughness={0.5} texture={tex.jacket} bumpScale={0.9} />
      <FacetMesh geometry={geo.collar} side={2} roughness={0.8} />
      {/* 后颈的兜帽卷 */}
      <FacetMesh geometry={geo.hood} position={[CX, 1.445, -0.095]} rotation={[0.35, 0, 0]} />
      {/* 衬衫翻领 */}
      {sides.map((s) => (
        <FacetMesh
          key={s}
          geometry={geo.collarFlap}
          position={[CX + s * 0.062, 1.385, 0.1]}
          rotation={[-0.3, s * 0.2, s * 0.55]}
          castShadow={false}
        />
      ))}

      {/* 外套细节：胸口斜拉链、腰部口袋盖、袖口魔术贴 */}
      {sides.map((s) => {
        const chest = onJacket(s, 0.135, 1.13);
        const pocket = onJacket(s, 0.135, 0.86);
        return (
          <group key={s}>
            {/* 胸口拉链：略斜 */}
            <mesh {...chest} castShadow={false}>
              <boxGeometry args={[0.008, 0.16, 0.008]} />
              <meshStandardMaterial color={C.lining} roughness={0.6} />
            </mesh>
            {/* 腰部口袋盖 */}
            <group position={pocket.position} rotation={pocket.rotation}>
              <mesh castShadow={false}>
                <boxGeometry args={[0.1, 0.014, 0.01]} />
                <meshStandardMaterial color={C.jacketDark} roughness={0.7} flatShading />
              </mesh>
              <mesh position={[0, -0.13, 0]} castShadow={false}>
                <boxGeometry args={[0.008, 0.26, 0.007]} />
                <meshStandardMaterial color={C.jacketDark} roughness={0.7} flatShading />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
}
