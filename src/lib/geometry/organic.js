import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash3, mulberry32 } from '../math/random';
import { makeLoftGeometry } from './loft';
import { smoothNormals } from './normals';
import { applyFaceTint, paintByPosition, toColor } from './vertexColor';

/**
 * 程序化“有机体”几何生成：原木、松针簇、岩石、草丛、团块。
 * 全部是纯函数，只返回 BufferGeometry（带 color 属性，配合 vertexColors + flatShading 使用），
 * 不依赖 React，任何 three.js 项目都能直接用。
 */

/**
 * 歪歪扭扭、树皮粗糙的原木（沿 +Y，粗端在下，细端朝上）。
 * 树皮颜色带纵向条纹，断面是浅色木芯。
 * @param {object} o
 * @param {number} o.radius 粗端半径
 * @param {number} o.length 长度
 * @param {number} [o.seed] 随机种子
 * @param {number} [o.wobble] 沿长度的弯曲幅度
 * @param {number} [o.taper] 细端 / 粗端半径比
 * @param {THREE.ColorRepresentation} [o.color] 树皮底色
 * @param {THREE.ColorRepresentation} [o.capColor] 断面颜色
 */
export function makeLogGeometry({
  radius,
  length,
  seed = 1,
  wobble = 0.02,
  taper = 0.85,
  color = '#5e4a39',
  capColor = '#c9a97c',
}) {
  const rnd = mulberry32(seed);
  const phaseA = rnd() * Math.PI * 2;
  const phaseB = rnd() * Math.PI * 2;
  const knotT = rnd();
  const knotTheta = rnd() * Math.PI * 2;
  const N = 6;
  const keys = [];
  for (let k = 0; k < N; k++) {
    const t = k / (N - 1);
    keys.push({
      p: [Math.sin(t * 5 + phaseA) * wobble, (t - 0.5) * length, Math.cos(t * 4 + phaseB) * wobble],
      a: radius * (1 + (taper - 1) * t),
    });
  }
  const base = toColor(color);
  const dark = base.clone().multiplyScalar(0.7);
  const light = base.clone().lerp(new THREE.Color('#a4927f'), 0.35);
  return makeLoftGeometry({
    keys,
    samples: Math.max(6, Math.round(length / 0.12)),
    segments: 7,
    jitter: 0.1,
    seed,
    faceTint: 0.07,
    capColor,
    // 树瘤：局部鼓起
    profile: (t, theta) => {
      const dt = (t - knotT) / 0.08;
      const dth = Math.atan2(Math.sin(theta - knotTheta), Math.cos(theta - knotTheta)) / 0.6;
      return 1 + 0.22 * Math.exp(-(dt * dt + dth * dth));
    },
    // 树皮：沿长度方向的深浅条纹
    color: (t, theta) => {
      const stripe = hash3(Math.round(theta * 2.4), Math.round(t * length * 6), 1.7, seed);
      return stripe > 0.62 ? light : stripe < 0.28 ? dark : base;
    },
  });
}

/**
 * 松针簇：很多根细长的三棱锥从中心向四周放射，合并成一个几何体。
 * 针叶颜色从根部（深）到针尖（浅）渐变。
 * @param {number} [seed] 随机种子
 * @param {number} [count] 松针数量
 * @param {number} [len] 单根松针基准长度
 * @param {{base:THREE.ColorRepresentation, tip:THREE.ColorRepresentation}} [colors]
 */
export function makeNeedlePadGeometry(
  seed = 1,
  count = 110,
  len = 0.24,
  colors = { base: '#3d5527', tip: '#8fb05c' },
) {
  const rnd = mulberry32(seed);
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const cBase = toColor(colors.base);
  const cTip = toColor(colors.tip);
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const h = len * (0.65 + rnd() * 0.7);
    const cone = new THREE.ConeGeometry(0.0095, h, 3, 1);
    cone.translate(0, h / 2, 0);
    // 渐变色：越靠近针尖越亮，再加随机明暗
    const pos = cone.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    const shade = 0.85 + rnd() * 0.3;
    for (let k = 0; k < pos.count; k++) {
      tmp.copy(cBase).lerp(cTip, Math.min(1, Math.max(0, pos.getY(k) / h))).multiplyScalar(shade);
      arr[k * 3] = tmp.r;
      arr[k * 3 + 1] = tmp.g;
      arr[k * 3 + 2] = tmp.b;
    }
    cone.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    const theta = rnd() * Math.PI * 2;
    // 仰角偏向水平略向上，形成“扇形”的松针簇
    const el = -0.45 + rnd() * 1.35;
    const dir = new THREE.Vector3(Math.cos(theta) * Math.cos(el), Math.sin(el), Math.sin(theta) * Math.cos(el)).normalize();
    cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    cone.translate((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.025, (rnd() - 0.5) * 0.05);
    parts.push(cone);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * 把一个 IcosahedronGeometry 揉成凹凸不平的岩石，顶面略亮、侧面略暗。
 * @param {number} [seed] 随机种子
 * @param {number} [squash] 纵向压扁系数
 * @param {{color?:THREE.ColorRepresentation, detail?:number, faceTint?:number}} [opt]
 */
export function makeRockGeometry(seed = 1, squash = 0.8, { color = '#807d78', detail = 1, faceTint = 0.1 } = {}) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = 0.72 + hash3(v.x, v.y, v.z, seed) * 0.55;
    p.setXYZ(i, v.x * r, v.y * r * squash, v.z * r);
  }
  g.computeVertexNormals();
  const base = toColor(color);
  paintByPosition(g, (x, y, z) => {
    const k = 0.78 + 0.34 * THREE.MathUtils.clamp((y / squash + 1) / 2, 0, 1);
    return base.clone().multiplyScalar(k);
  });
  applyFaceTint(g, faceTint, seed);
  return g;
}

/**
 * 低多边形“团块”：细分少的球体，带随机凹凸，可非均匀缩放。
 * 用来做拳头、肩头、关节、帽子、灌木等。
 * @param {object} [o]
 * @param {number} [o.radius]
 * @param {number} [o.detail] 细分级别，0=20 面，1=80 面
 * @param {number[]} [o.scale] 各轴缩放
 * @param {number} [o.jitter] 顶点随机扰动
 * @param {THREE.ColorRepresentation} [o.color]
 * @param {boolean|{crease?:number}} [o.smooth] 算平滑法线（皮肤 / 五官用）
 */
export function makeBlobGeometry({
  radius = 1,
  detail = 1,
  scale = [1, 1, 1],
  jitter = 0.08,
  seed = 1,
  color = '#cccccc',
  faceTint = 0.04,
  smooth = false,
} = {}) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = 1 + (hash3(v.x * 9.1, v.y * 9.1, v.z * 9.1, seed) - 0.5) * 2 * jitter;
    p.setXYZ(i, v.x * r * scale[0], v.y * r * scale[1], v.z * r * scale[2]);
  }
  g.computeVertexNormals();
  if (smooth) smoothNormals(g, smooth === true ? undefined : smooth);
  paintByPosition(g, () => color);
  applyFaceTint(g, faceTint, seed);
  return g;
}

/**
 * 草丛：在给定点位上各长出一小撮草叶（细三棱锥），合并成一个几何体。
 * @param {number[][]} points 每个草丛的根部位置 [x,y,z]
 * @param {object} [o]
 * @param {number} [o.blades] 每丛草叶数
 * @param {number} [o.height] 基准高度
 * @param {THREE.ColorRepresentation[]} [o.palette] 草叶底色候选（每丛随机取一个）
 */
export function makeGrassGeometry(
  points,
  { blades = 7, height = 0.2, seed = 1, palette = ['#a98a52', '#8c6a3c', '#b79a5f'] } = {},
) {
  const rnd = mulberry32(seed);
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Color();
  for (const pt of points) {
    const base = toColor(palette[Math.floor(rnd() * palette.length)]);
    const root = base.clone().multiplyScalar(0.45);
    for (let b = 0; b < blades; b++) {
      const h = height * (0.6 + rnd() * 0.8);
      const blade = new THREE.ConeGeometry(0.011, h, 3, 1);
      blade.translate(0, h / 2, 0);
      const pos = blade.attributes.position;
      const arr = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        tmp.copy(root).lerp(base, Math.min(1, Math.max(0, pos.getY(k) / h)));
        arr[k * 3] = tmp.r;
        arr[k * 3 + 1] = tmp.g;
        arr[k * 3 + 2] = tmp.b;
      }
      blade.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      const th = rnd() * Math.PI * 2;
      const lean = 0.15 + rnd() * 0.55;
      const dir = new THREE.Vector3(Math.cos(th) * lean, 1, Math.sin(th) * lean).normalize();
      blade.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
      blade.translate(pt[0] + (rnd() - 0.5) * 0.05, pt[1], pt[2] + (rnd() - 0.5) * 0.05);
      parts.push(blade);
    }
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}
