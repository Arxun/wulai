import { useMemo } from 'react';
import FacetMesh from '../../../lib/components/FacetMesh';
import { makeLoftGeometry } from '../../../lib/geometry/loft';
import { makeBlobGeometry } from '../../../lib/geometry/organic';
import { skinTextures } from '../../../lib/textures/procedural';
import { toColor } from '../../../lib/geometry/vertexColor';
import { C } from './palette';

/**
 * 握拳（手背朝向镜头）：掌骨 + 四根分节弯曲的手指 + 拇指 + 指节凸起 + 指甲。
 *
 * 局部坐标：+X 是手腕一侧（前臂从这边接进来），-X 是指尖方向；
 * +Z 是手背朝外，-Z 是掌心；手指沿 Y 方向并排，食指在上、小指在下。
 * 尺寸取自照片：拳头约 0.115 宽 × 0.13 高。
 *
 * 手指同样是「高密度放样 + 平滑法线」：指节的鼓包和指间的收腰靠 profile 做出来，
 * 不再是一根根方棱的柱子，这样握拳才有肉感。
 */

// 每根手指：[y 偏移, 长度系数, 半径, 根部 z 偏移]
const FINGERS = [
  { y: 0.042, len: 1.0, r: 0.0136, z: 0.002 }, // 食指
  { y: 0.0145, len: 1.05, r: 0.014, z: 0.004 }, // 中指
  { y: -0.0135, len: 0.98, r: 0.0133, z: 0.002 }, // 无名指
  { y: -0.039, len: 0.85, r: 0.0119, z: -0.002 }, // 小指
];

/** 指节处略深（关节褶皱）、指背略亮：t 是沿手指从指根到指尖的 0~1 */
const fingerColor = (base, shade) => {
  const b = toColor(base);
  const s = toColor(shade);
  const warm = toColor('#e0a893');
  return (t, theta) => {
    // 两个关节处出现细细的暗纹
    const crease = Math.exp(-(((t - 0.34) / 0.035) ** 2)) + Math.exp(-(((t - 0.68) / 0.035) ** 2));
    const c = b.clone().lerp(s, Math.min(0.75, crease * 0.65));
    // 指背受光略亮、指侧偏暖（指节皮肤薄的地方泛红）
    const back = Math.max(0, Math.cos(theta));
    c.lerp(warm, 0.3 * Math.max(0, Math.sin(theta)) * Math.exp(-(((t - 0.5) / 0.4) ** 2)));
    c.multiplyScalar(1 + 0.04 * back);
    return c;
  };
};

/** 指节鼓起 + 指间收腰 */
const fingerProfile = (t, theta) => {
  const joint =
    0.08 * Math.exp(-(((t - 0.06) / 0.1) ** 2)) + // 掌指关节
    0.1 * Math.exp(-(((t - 0.37) / 0.09) ** 2)) + // 近侧指间关节
    0.07 * Math.exp(-(((t - 0.7) / 0.08) ** 2)); // 远侧指间关节
  const waist = -0.05 * (Math.exp(-(((t - 0.22) / 0.08) ** 2)) + Math.exp(-(((t - 0.54) / 0.08) ** 2)));
  // 指背（θ=0 一侧）偏扁，指腹（θ=π）偏圆
  const flat = -0.08 * Math.max(0, Math.cos(theta)) ** 2;
  return 1 + joint + waist + flat;
};

export default function Hand({ position, rotation = [0, 0, 0], scale = 1 }) {
  const tex = useMemo(() => skinTextures({ ruddy: 0.12 }), []);
  const g = useMemo(() => {
    const finger = (f, i) => {
      const L = f.len;
      return makeLoftGeometry({
        keys: [
          // 近节指骨沿手背向前，中节向下弯，指尖折进掌心——从正面看每根手指只露出约 5cm
          { p: [0.03, f.y, 0.014 + f.z], a: f.r * 1.02, b: f.r * 0.98 },
          { p: [0.03 - 0.03 * L, f.y, 0.028 + f.z], a: f.r, b: f.r * 0.97 },
          { p: [0.03 - 0.052 * L, f.y, 0.021 + f.z], a: f.r * 0.95, b: f.r * 0.92 },
          { p: [0.03 - 0.058 * L, f.y - 0.001, 0.001 + f.z], a: f.r * 0.88, b: f.r * 0.86 },
          { p: [0.03 - 0.049 * L, f.y - 0.002, -0.017 + f.z], a: f.r * 0.72, b: f.r * 0.7 },
          { p: [0.03 - 0.032 * L, f.y - 0.003, -0.026 + f.z], a: f.r * 0.42, b: f.r * 0.4 },
        ],
        ref: [0, 1, 0],
        samples: 30,
        segments: 16,
        smooth: { crease: 68 },
        profile: fingerProfile,
        color: fingerColor(C.skin, C.skinShade),
        faceTint: 0.012,
        uvMeters: 0.055,
        seed: 300 + i,
      });
    };
    // 掌骨：从手腕到指根逐渐变宽、同时变扁（手是薄的，别做成拳套）
    // 局部放样坐标：θ=0 → 掌心（-Z），θ=π → 手背（+Z），θ=π/2 → 食指侧（+Y）
    const back = makeLoftGeometry({
      keys: [
        { p: [0.084, 0.0, -0.004], a: 0.019, b: 0.03 },
        { p: [0.064, 0.001, 0.002], a: 0.021, b: 0.041 },
        { p: [0.044, 0.002, 0.008], a: 0.022, b: 0.051 },
        { p: [0.028, 0.002, 0.013], a: 0.022, b: 0.055 },
        { p: [0.018, 0.0, 0.012], a: 0.019, b: 0.052 },
      ],
      ref: [0, 1, 0],
      samples: 26,
      segments: 24,
      smooth: { crease: 70 },
      profile: (t, theta) => {
        const back2 = Math.max(0, -Math.cos(theta));
        const palm = Math.max(0, Math.cos(theta));
        const down = Math.max(0, -Math.sin(theta));
        return (
          1
          + 0.07 * down * Math.exp(-(((t - 0.45) / 0.3) ** 2)) // 小鱼际
          + 0.09 * palm * Math.exp(-(((t - 0.3) / 0.22) ** 2)) // 掌心肉垫
          + 0.07 * back2 * Math.exp(-(((t - 0.84) / 0.12) ** 2)) // 掌指关节一排的隆起
        );
      },
      color: C.skin,
      faceTint: 0.012,
      uvMeters: 0.07,
      seed: 320,
    });
    // 拇指：从桡侧根部贴着掌心折过去，手背视角基本看不见（照片里就是藏住的）
    const thumb = makeLoftGeometry({
      keys: [
        { p: [0.064, 0.026, -0.008], a: 0.019, b: 0.018 },
        { p: [0.042, 0.042, -0.008], a: 0.0175, b: 0.0165 },
        { p: [0.016, 0.051, -0.004], a: 0.0155, b: 0.0148 },
        { p: [-0.008, 0.05, 0.002], a: 0.0135, b: 0.013 },
        { p: [-0.023, 0.045, 0.004], a: 0.0105, b: 0.0105 },
      ],
      ref: [0, 1, 0],
      samples: 22,
      segments: 18,
      smooth: { crease: 68 },
      profile: (t) => 1 + 0.08 * Math.exp(-(((t - 0.58) / 0.12) ** 2)) - 0.04 * Math.exp(-(((t - 0.34) / 0.1) ** 2)),
      color: fingerColor(C.skin, C.skinShade),
      faceTint: 0.012,
      uvMeters: 0.06,
      seed: 310,
    });
    return {
      fingers: FINGERS.map(finger),
      thumb,
      back,
      knuckle: makeBlobGeometry({ radius: 0.0095, detail: 2, scale: [1, 0.88, 0.6], jitter: 0.02, color: '#d9a08b', smooth: true, seed: 321 }),
      nail: makeBlobGeometry({ radius: 0.008, detail: 2, scale: [1.0, 0.95, 0.3], jitter: 0.015, color: '#e8d3c6', smooth: true, seed: 322 }),
    };
  }, []);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* 掌骨 */}
      <FacetMesh geometry={g.back} roughness={0.7} texture={tex} bumpScale={0.3} smooth />
      {/* 指节：手背上四个小凸起，刚好顶出掌骨表面 */}
      {FINGERS.map((f, i) => (
        <FacetMesh key={`k${i}`} geometry={g.knuckle} position={[0.027, f.y, 0.029 + f.z * 0.5]} roughness={0.66} texture={tex} bumpScale={0.3} smooth />
      ))}
      {/* 手指 */}
      {g.fingers.map((geo, i) => (
        <FacetMesh key={i} geometry={geo} roughness={0.66} texture={tex} bumpScale={0.3} smooth />
      ))}
      {/* 拇指和指甲 */}
      <FacetMesh geometry={g.thumb} roughness={0.68} texture={tex} bumpScale={0.3} smooth />
      <FacetMesh geometry={g.nail} position={[-0.026, 0.047, 0.006]} rotation={[0.1, 0.2, 1.1]} roughness={0.3} castShadow={false} smooth />
    </group>
  );
}
