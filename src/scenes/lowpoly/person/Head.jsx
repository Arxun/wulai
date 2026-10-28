import { useMemo } from 'react';
import * as THREE from 'three';
import FacetMesh from '../../../lib/components/FacetMesh';
import { makeHairGeometry } from '../../../lib/geometry/hair';
import { makeLoftGeometry } from '../../../lib/geometry/loft';
import { makeBlobGeometry } from '../../../lib/geometry/organic';
import { toColor } from '../../../lib/geometry/vertexColor';
import { skinTextures } from '../../../lib/textures/procedural';
import { C } from './palette';

/**
 * 头通道：Person 把 headYaw / headPitch 加在颈根，这块网格跟着转。
 * 头部：脸 + 五官 + 发束头发 + 大墨镜。
 *
 * 脸和五官是「高密度放样 + 平滑法线」，不是逐面硬着色——人脸一旦有硬棱角就不像人了；
 * 形体靠 FACE_FEATURES 里一组解剖学鼓包 / 凹陷叠加出来（颧骨、咬肌、眼窝、眉弓、人中、颏唇沟……），
 * 衣服、头发仍然保持低多边形的硬面，这样整体风格还是统一的。
 *
 * 照片里的特征：
 *  - 脸偏圆偏宽，颧骨饱满，下颌柔和，下巴圆；鼻梁低、鼻头圆、鼻翼宽；嘴微张露一点牙；
 *  - 头发短而浓密：头顶向后上方梳起，刘海从左上向右下斜扫，两侧剪短盖住鬓角；
 *  - 墨镜是偏方形的大圆角镜片（近乎正方），深藏青色，细黑框，左镜腿是黑白条纹；
 *  - 头微微转向画面右侧。
 * 头顶 y≈1.78、下巴 y≈1.43、眼线 y≈1.60、嘴缝 y≈1.4955。
 */

const PI = Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 高度方向的高斯窗（y 为世界高度，单位米） */
const gy = (y, c, s) => Math.exp(-(((y - c) / s) ** 2));
/** 截面角度上的高斯窗，c 为中心角度 */
const ga = (theta, c, s) => Math.exp(-((wrap(theta - c) / s) ** 2));
/** 关于正脸（θ=π/2）左右对称的一对，o 是离正中的角距 */
const pair = (theta, o, s) => ga(theta, PI / 2 - o, s) + ga(theta, PI / 2 + o, s);

/** 脸的控制截面：下巴 → 头顶。a 是左右半宽，b 是前后半厚 */
const FACE_KEYS = [
  { p: [0, 1.435, 0.05], a: 0.074, b: 0.056 },
  { p: [0, 1.47, 0.032], a: 0.104, b: 0.08 },
  { p: [0, 1.52, 0.016], a: 0.109, b: 0.09 },
  { p: [0, 1.58, 0.006], a: 0.112, b: 0.098 },
  { p: [0, 1.64, 0.0], a: 0.11, b: 0.1 },
  { p: [0, 1.7, -0.006], a: 0.101, b: 0.098 },
  { p: [0, 1.74, -0.011], a: 0.077, b: 0.081 },
  { p: [0, 1.765, -0.013], a: 0.036, b: 0.04 },
];
const FACE_Y = FACE_KEYS.map((k) => k.p[1]);
/** 由放样参数 t 反查世界高度（线性近似，够用来定位五官） */
const faceY = (t) => {
  const f = t * (FACE_Y.length - 1);
  const i = Math.min(FACE_Y.length - 2, Math.floor(f));
  return THREE.MathUtils.lerp(FACE_Y[i], FACE_Y[i + 1], f - i);
};
/** 脸的平均半径，用来把“毫米级的凸起”换算成放样的径向缩放系数 */
const FACE_R = 0.105;

/**
 * 面部解剖特征：每条是一个叠加在脸上的鼓包（d>0）或凹陷（d<0）。
 * y/ys 是高度中心与范围，d 是凸起量（米），ang 决定它在截面上的分布。
 */
const FACE_FEATURES = [
  // 下半脸
  { y: 1.4475, ys: 0.014, d: 0.006, ang: (th) => ga(th, PI / 2, 0.5) }, // 下巴颏
  { y: 1.4705, ys: 0.009, d: -0.003, ang: (th) => ga(th, PI / 2, 0.4) }, // 颏唇沟
  { y: 1.4965, ys: 0.017, d: 0.003, ang: (th) => ga(th, PI / 2, 0.6) }, // 口轮匝肌
  { y: 1.5135, ys: 0.008, d: -0.0015, ang: (th) => ga(th, PI / 2, 0.11) }, // 人中
  { y: 1.5075, ys: 0.013, d: -0.002, ang: (th) => pair(th, 0.44, 0.15) }, // 鼻唇沟
  { y: 1.4875, ys: 0.023, d: 0.004, ang: (th) => pair(th, 1.24, 0.3) }, // 下颌角
  { y: 1.5135, ys: 0.03, d: 0.004, ang: (th) => pair(th, 1.03, 0.34) }, // 咬肌
  { y: 1.5275, ys: 0.018, d: -0.003, ang: (th) => pair(th, 0.75, 0.26) }, // 颊凹
  // 中段
  { y: 1.5665, ys: 0.021, d: 0.005, ang: (th) => pair(th, 0.86, 0.38) }, // 颧骨
  { y: 1.6015, ys: 0.016, d: -0.004, ang: (th) => pair(th, 0.5, 0.26) }, // 眼窝
  { y: 1.6155, ys: 0.01, d: -0.002, ang: (th) => ga(th, PI / 2, 0.13) }, // 鼻根
  // 上半脸
  { y: 1.629, ys: 0.012, d: 0.004, ang: (th) => pair(th, 0.44, 0.42) }, // 眉弓
  { y: 1.632, ys: 0.011, d: 0.002, ang: (th) => ga(th, PI / 2, 0.14) }, // 眉间
  { y: 1.655, ys: 0.03, d: -0.005, ang: (th) => pair(th, 1.27, 0.3) }, // 太阳穴
  { y: 1.692, ys: 0.023, d: 0.002, ang: (th) => pair(th, 0.34, 0.3) }, // 额丘
  { y: 1.645, ys: 0.05, d: 0.004, ang: (th) => ga(th, -PI / 2, 0.9) }, // 后脑
];

/** 圆角矩形（镜片 / 镜框轮廓），底边略窄 */
function lensShape(w, h, r, bottomInset = 0.008) {
  const s = new THREE.Shape();
  const x = w / 2;
  const y = h / 2;
  s.moveTo(-x + r + bottomInset, -y);
  s.lineTo(x - r - bottomInset, -y);
  s.quadraticCurveTo(x - bottomInset, -y, x - bottomInset + 0.002, -y + r);
  s.lineTo(x, y - r);
  s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y);
  s.quadraticCurveTo(-x, y, -x, y - r);
  s.lineTo(-x + bottomInset - 0.002, -y + r);
  s.quadraticCurveTo(-x + bottomInset, -y, -x + r + bottomInset, -y);
  return s;
}

/** 发际线：返回某方位角（度）处发根允许的最低仰角。左额（画面左）高一点，右额低一点，形成斜刘海 */
const hairline = (az) => {
  if (az > 20 && az < 160) return 15 + THREE.MathUtils.clamp(((az - 90) / 50) * 7, -7, 7);
  if (az > 215 && az < 325) return -34; // 脑后发际线低，一直到后颈上方
  return -5;
};

const HAIR_REGIONS = [
  // ===== 粗大的发簇：构成头发的体量和走向（整体贴着头皮往后上方梳，不是竖起来） =====
  // 头顶：向后上方梳起，略偏右
  { count: 52, az: [0, 360], el: [52, 89], length: [0.036, 0.056], width: [0.042, 0.064], thick: 0.013, flow: [0.4, 0.05, -0.2], lift: 0.1, curl: 0.6 },
  // 刘海（画面右半）：向右下斜扫，盖到额头
  { count: 26, az: [34, 105], el: [15, 58], length: [0.05, 0.075], width: [0.032, 0.048], thick: 0.011, flow: [0.6, -0.55, 0.45], lift: 0.1, curl: 0.5 },
  // 刘海（画面左半）：根部上翘后向右压
  { count: 18, az: [100, 156], el: [17, 60], length: [0.045, 0.07], width: [0.03, 0.046], thick: 0.011, flow: [0.4, -0.3, 0.35], lift: 0.14, curl: 0.5 },
  // 两侧：剪得很短，贴着头皮往下，盖住鬓角
  { count: 20, az: [150, 215], el: [-4, 40], length: [0.03, 0.048], width: [0.026, 0.042], thick: 0.009, flow: [0, -0.55, -0.04], lift: 0.1, curl: 0.2 },
  { count: 20, az: [-35, 30], el: [-4, 40], length: [0.03, 0.048], width: [0.026, 0.042], thick: 0.009, flow: [0, -0.55, -0.04], lift: 0.1, curl: 0.2 },
  // 脑后：也是短的，顺着后脑往下压，别往外炸
  { count: 40, az: [215, 325], el: [-32, 72], length: [0.03, 0.05], width: [0.032, 0.05], thick: 0.01, flow: [0.05, -0.55, -0.06], lift: 0.12, curl: 0.3 },
  // ===== 细发丝：顶上几缕翘起的碎发（照片里头顶左侧有几根飘起的） =====
  { count: 6, az: [60, 200], el: [62, 89], length: [0.04, 0.062], width: [0.011, 0.016], thick: 0.0045, flow: [0.35, 0.25, -0.15], lift: 0.24, curl: 0.9 },
  { count: 16, az: [34, 150], el: [20, 56], length: [0.035, 0.055], width: [0.012, 0.018], thick: 0.0045, flow: [0.55, -0.3, 0.4], lift: 0.22, curl: 0.5 },
];

export default function Head() {
  const tex = useMemo(() => skinTextures({ ruddy: 0.14 }), []);

  const g = useMemo(() => {
    const skin = toColor(C.skin);
    const shade = toColor(C.skinShade);
    const blush = toColor('#e29e88');
    const beardTone = toColor('#b78a78');

    const neck = makeLoftGeometry({
      keys: [
        { p: [0, 1.33, 0], a: 0.068, b: 0.066 },
        { p: [0, 1.4, 0.004], a: 0.063, b: 0.062 },
        { p: [0, 1.46, 0.01], a: 0.06, b: 0.06 },
      ],
      samples: 10,
      segments: 20,
      color: C.skinShade,
      uvMeters: 0.12,
      smooth: true,
      faceTint: 0.01,
      seed: 101,
    });

    // 脸：高密度放样 + 解剖起伏 + 平滑法线
    const face = makeLoftGeometry({
      keys: FACE_KEYS,
      samples: 46,
      segments: 56,
      jitter: 0.0015,
      uvMeters: 0.085,
      smooth: true,
      profile: (t, theta) => {
        const y = faceY(t);
        let d = 0;
        for (const f of FACE_FEATURES) d += f.d * gy(y, f.y, f.ys) * f.ang(theta);
        return 1 + d / FACE_R;
      },
      color: (t, theta) => {
        const y = faceY(t);
        const front = smooth(0.05, 0.45, Math.sin(theta));
        // 颧骨泛红
        const w = gy(y, 1.565, 0.026) * pair(theta, 0.85, 0.45) * front * 0.42;
        const c = skin.clone().lerp(blush, Math.min(0.55, w));
        // 很淡的胡茬区（下颌 + 下巴 + 上唇），照片里几乎刮干净了，只留一点冷色
        const beard = Math.min(
          1,
          gy(y, 1.476, 0.036) * (0.45 + 0.55 * ga(theta, PI / 2, 1.15)) + 0.8 * gy(y, 1.516, 0.009) * ga(theta, PI / 2, 0.34),
        );
        c.lerp(beardTone, beard * 0.16);
        // 眼窝 / 下颌线压暗，额头与鼻梁提亮
        c.multiplyScalar(1 - 0.1 * gy(y, 1.6, 0.016) * pair(theta, 0.5, 0.3));
        c.multiplyScalar(1 - 0.08 * gy(y, 1.472, 0.02) * ga(theta, PI / 2, 1.1));
        c.multiplyScalar(1 + 0.05 * gy(y, 1.7, 0.035) * front);
        if (y < 1.45) c.lerp(shade, (1.45 - y) / 0.015 * 0.25);
        return c;
      },
      faceTint: 0.008,
      seed: 103,
    });

    // 头发底：包住头皮的薄壳，前面敞开露出额头；发束从它上面长出来
    const hairCap = makeLoftGeometry({
      keys: [
        { p: [0, 1.525, -0.012], a: 0.1, b: 0.096 },
        { p: [0, 1.6, -0.01], a: 0.116, b: 0.109 },
        { p: [0, 1.67, -0.01], a: 0.118, b: 0.109 },
        { p: [0, 1.73, -0.014], a: 0.101, b: 0.099 },
        { p: [0, 1.775, -0.016], a: 0.055, b: 0.055 },
        { p: [0, 1.795, -0.014], a: 0.022, b: 0.022 },
      ],
      samples: 9,
      segments: 16,
      gap: {
        center: PI / 2,
        half: (t) => (t < 0.3 ? 1.9 : t < 0.5 ? 1.9 - ((t - 0.3) / 0.2) * 1.9 : 0),
      },
      thickness: 0.016,
      color: '#0d0a08',
      innerColor: '#0a0806',
      rimColor: '#0d0a08',
      faceTint: 0.08,
      seed: 105,
    });

    const hair = makeHairGeometry({
      center: [0, 1.645, -0.008],
      radii: [0.12, 0.137, 0.116],
      regions: HAIR_REGIONS,
      hairline,
      palette: ['#0f0c0a', '#16110d', '#1c1511'],
      seed: 7,
    });

    // ---- 鼻子：低鼻梁、圆鼻头、宽鼻翼，鼻翼靠 profile 在底部向两侧张开 ----
    const nose = makeLoftGeometry({
      keys: [
        { p: [0, 1.619, 0.09], a: 0.0105, b: 0.009 },
        { p: [0, 1.594, 0.096], a: 0.0112, b: 0.0102 },
        { p: [0, 1.568, 0.104], a: 0.0128, b: 0.0122 },
        { p: [0, 1.548, 0.113], a: 0.0152, b: 0.014 },
        { p: [0, 1.535, 0.119], a: 0.0168, b: 0.0148 },
        { p: [0, 1.526, 0.116], a: 0.0162, b: 0.0132 },
        { p: [0, 1.521, 0.107], a: 0.013, b: 0.0105 },
      ],
      samples: 22,
      segments: 20,
      smooth: { crease: 62 },
      uvMeters: 0.07,
      profile: (t, theta) => {
        // t≈0 鼻根，t≈1 鼻底；鼻翼在 t 0.72~0.95 向两侧（θ=0 / π）张开
        const low = Math.exp(-(((t - 0.84) / 0.12) ** 2));
        const lateral = Math.abs(Math.cos(theta)) ** 2;
        return 1 + 0.42 * low * lateral;
      },
      color: (t, theta) => {
        const c = skin.clone();
        // 鼻头略红，鼻底压暗
        c.lerp(toColor('#d79a85'), 0.5 * Math.exp(-(((t - 0.72) / 0.16) ** 2)) * Math.max(0, Math.sin(theta)));
        c.multiplyScalar(1 - 0.22 * Math.exp(-(((t - 0.97) / 0.08) ** 2)));
        return c;
      },
      faceTint: 0.01,
      seed: 111,
    });
    const nostril = makeBlobGeometry({ radius: 0.0052, detail: 1, scale: [1, 0.55, 1.25], jitter: 0.02, color: '#39201e', smooth: true, seed: 114 });

    // ---- 嘴唇：沿嘴线放样（a 是前后厚度、b 是上下高度），上唇带唇峰 ----
    const lipColor = (base, corner) => {
      const b = toColor(base);
      const k = toColor(corner);
      return (t) => b.clone().lerp(k, Math.min(1, (Math.abs(t - 0.5) / 0.5) ** 2.2));
    };
    const upperLip = makeLoftGeometry({
      keys: [
        { p: [-0.0265, 1.5015, 0.0855], a: 0.003, b: 0.004 },
        { p: [-0.016, 1.504, 0.1015], a: 0.0044, b: 0.0062 },
        { p: [0, 1.5058, 0.1058], a: 0.005, b: 0.0072 },
        { p: [0.016, 1.504, 0.1015], a: 0.0044, b: 0.0062 },
        { p: [0.0265, 1.5015, 0.0855], a: 0.003, b: 0.004 },
      ],
      ref: [0, 1, 0],
      samples: 26,
      segments: 14,
      smooth: { crease: 60 },
      uvMeters: 0.05,
      profile: (t, theta) => {
        const up = Math.max(0, Math.sin(theta));
        // 唇峰（两个高点）与中间的小凹
        const peak = Math.exp(-(((t - 0.37) / 0.09) ** 2)) + Math.exp(-(((t - 0.63) / 0.09) ** 2));
        const dip = Math.exp(-(((t - 0.5) / 0.065) ** 2));
        return 1 + up * (0.2 * peak - 0.26 * dip);
      },
      color: lipColor('#ab7a70', '#8b6058'),
      faceTint: 0.012,
      seed: 120,
    });
    const lowerLip = makeLoftGeometry({
      keys: [
        { p: [-0.0245, 1.4935, 0.0862], a: 0.0028, b: 0.0034 },
        { p: [-0.0135, 1.4885, 0.102], a: 0.005, b: 0.0068 },
        { p: [0, 1.4862, 0.1062], a: 0.0062, b: 0.0082 },
        { p: [0.0135, 1.4885, 0.102], a: 0.005, b: 0.0068 },
        { p: [0.0245, 1.4935, 0.0862], a: 0.0028, b: 0.0034 },
      ],
      ref: [0, 1, 0],
      samples: 26,
      segments: 14,
      smooth: { crease: 60 },
      uvMeters: 0.05,
      color: lipColor('#b98b7f', '#8f6b61'),
      faceTint: 0.012,
      seed: 121,
    });
    const mouthIn = makeBlobGeometry({ radius: 0.016, detail: 1, scale: [1.6, 0.26, 0.5], jitter: 0.02, color: '#3a1917', smooth: true, seed: 122 });
    const teeth = makeBlobGeometry({ radius: 0.0135, detail: 1, scale: [1.45, 0.2, 0.34], jitter: 0.01, color: '#e9e0d2', smooth: true, seed: 123 });

    // ---- 耳朵：耳廓 + 耳轮 + 对耳轮 + 耳窝 + 耳垂 + 耳屏 ----
    const ear = makeBlobGeometry({ radius: 0.034, detail: 2, scale: [0.25, 1.04, 0.7], jitter: 0.02, color: '#d5a48c', smooth: true, seed: 130 });
    const torusColored = (geo, color) => {
      const nonIdx = geo.toNonIndexed();
      const n = nonIdx.attributes.position.count;
      const arr = new Float32Array(n * 3);
      const c = toColor(color);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      nonIdx.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return nonIdx;
    };
    const helix = new THREE.TorusGeometry(0.0215, 0.0048, 8, 20, PI * 1.5);
    helix.rotateY(PI / 2);
    helix.rotateX(PI * 0.1);
    const antihelix = new THREE.TorusGeometry(0.0125, 0.0035, 7, 14, PI * 1.15);
    antihelix.rotateY(PI / 2);
    antihelix.rotateX(PI * 0.1);
    const concha = makeBlobGeometry({ radius: 0.013, detail: 1, scale: [0.22, 1, 0.58], jitter: 0.02, color: '#a8705e', smooth: true, seed: 131 });
    const lobe = makeBlobGeometry({ radius: 0.012, detail: 2, scale: [0.46, 1.05, 0.8], jitter: 0.02, color: '#d9a58f', smooth: true, seed: 132 });
    const tragus = makeBlobGeometry({ radius: 0.006, detail: 1, scale: [0.5, 1.1, 0.7], jitter: 0.02, color: '#cf9a82', smooth: true, seed: 133 });

    // ---- 墨镜 ----
    const frameShape = lensShape(0.12, 0.1, 0.028);
    const lensGeo = lensShape(0.111, 0.091, 0.024);
    const frame = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelSize: 0.0025,
      bevelThickness: 0.0025,
      bevelSegments: 2,
      curveSegments: 8,
    });
    const lens = new THREE.ExtrudeGeometry(lensGeo, { depth: 0.012, bevelEnabled: false, curveSegments: 8 });
    return {
      neck, face, hairCap, hair,
      nose, nostril,
      upperLip, lowerLip, mouthIn, teeth,
      ear,
      helix: torusColored(helix, '#d09a82'),
      antihelix: torusColored(antihelix, '#c89078'),
      concha, lobe, tragus,
      frame, lens,
    };
  }, []);

  // 左镜腿（画面左）是黑白条纹的
  const stripes = [0, 1, 2, 3, 4, 5];

  return (
    <group position={[0.024, 0, 0]} rotation={[-0.02, 0.15, 0.02]}>
      <FacetMesh geometry={g.neck} roughness={0.75} texture={tex} bumpScale={0.35} smooth />
      <FacetMesh geometry={g.face} roughness={0.58} texture={tex} bumpScale={0.22} smooth />

      {/* 耳朵 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.1125, 1.585, -0.006]} scale={[s, 1, 1]} rotation={[0, 0, 0.05]}>
          <FacetMesh geometry={g.ear} roughness={0.68} texture={tex} bumpScale={0.25} smooth />
          <FacetMesh geometry={g.helix} position={[0.007, 0.002, 0]} roughness={0.68} castShadow={false} smooth />
          <FacetMesh geometry={g.antihelix} position={[0.0, 0.0, -0.004]} roughness={0.7} castShadow={false} smooth />
          <FacetMesh geometry={g.concha} position={[-0.004, 0.0, 0.002]} roughness={0.8} castShadow={false} smooth />
          <FacetMesh geometry={g.tragus} position={[-0.001, -0.006, 0.014]} roughness={0.7} castShadow={false} smooth />
          <FacetMesh geometry={g.lobe} position={[0.002, -0.033, 0.002]} roughness={0.7} smooth />
        </group>
      ))}

      {/* 鼻子 + 鼻孔 */}
      <FacetMesh geometry={g.nose} roughness={0.56} texture={tex} bumpScale={0.2} smooth />
      {[-1, 1].map((s) => (
        <FacetMesh key={s} geometry={g.nostril} position={[s * 0.0105, 1.5215, 0.118]} rotation={[0.2, s * 0.25, 0]} castShadow={false} receiveShadow={false} smooth />
      ))}

      {/* 嘴：微张，露出一点牙 */}
      <FacetMesh geometry={g.mouthIn} position={[0, 1.4955, 0.1015]} castShadow={false} receiveShadow={false} smooth />
      <FacetMesh geometry={g.teeth} position={[0, 1.4985, 0.1035]} roughness={0.35} castShadow={false} smooth />
      <FacetMesh geometry={g.upperLip} roughness={0.52} castShadow={false} smooth />
      <FacetMesh geometry={g.lowerLip} roughness={0.5} castShadow={false} smooth />

      {/* 头发 */}
      <FacetMesh geometry={g.hairCap} side={2} roughness={0.8} />
      <FacetMesh geometry={g.hair} side={2} roughness={0.42} metalness={0.05} />

      {/* 墨镜 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.0612, 1.598, 0.082]} rotation={[0, s * 0.3, 0]}>
          <mesh geometry={g.frame} position={[0, 0, -0.001]} castShadow>
            <meshStandardMaterial color="#0b0b0f" roughness={0.4} />
          </mesh>
          <mesh geometry={g.lens} position={[0, 0, 0.0115]}>
            <meshPhysicalMaterial color="#0c121d" roughness={0.04} metalness={0.85} clearcoat={1} clearcoatRoughness={0.04} envMapIntensity={1.5} />
          </mesh>
          {/* 镜腿 */}
          <group position={[s * 0.0615, 0.014, -0.058]} rotation={[0, s * -0.16, 0]}>
            {s === -1 ? (
              stripes.map((i) => (
                <mesh key={i} position={[0, 0, 0.05 - i * 0.0185]} castShadow>
                  <boxGeometry args={[0.007, 0.014, 0.0185]} />
                  <meshStandardMaterial color={i % 2 ? '#0c0c10' : '#dfe3e6'} roughness={0.35} flatShading />
                </mesh>
              ))
            ) : (
              <mesh castShadow>
                <boxGeometry args={[0.007, 0.014, 0.11]} />
                <meshStandardMaterial color="#0b0b0f" roughness={0.4} flatShading />
              </mesh>
            )}
          </group>
        </group>
      ))}
      {/* 鼻梁架 */}
      <mesh position={[0, 1.614, 0.098]} castShadow>
        <boxGeometry args={[0.018, 0.007, 0.01]} />
        <meshStandardMaterial color="#0b0b0f" roughness={0.4} />
      </mesh>
    </group>
  );
}
