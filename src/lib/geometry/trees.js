import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeLoftGeometry } from './loft';
import { makeBlobGeometry, makeNeedlePadGeometry } from './organic';
import { applyFaceTint, paintByPosition, toColor } from './vertexColor';
import { mulberry32 } from '../math/random';

/**
 * 程序化树木：每棵树合并成**一个**几何体，一次绘制调用画完，可以在场景里铺很多棵。
 *
 * 三种：
 *   makeConiferGeometry  —— 层叠圆锥的针叶树，远看轮廓干净，适合成片的林子
 *   makeHuangshanPine    —— 黄山松：平顶、枝干横展、一簇簇放射状松针
 *   makeBroadleafGeometry—— 阔叶树：树干 + 几个团块树冠
 *
 * 所有树都以根部为原点（y=0 是地面），+Y 向上。
 */

/** mergeGeometries 要求所有几何体的索引状态一致，统一转成非索引 */
const flat = (g) => (g.index ? g.toNonIndexed() : g);

/** 合并并清理临时几何体 */
function combine(parts, tint, seed) {
  const merged = mergeGeometries(parts.map(flat), false);
  parts.forEach((p) => p.dispose());
  if (tint) applyFaceTint(merged, tint, seed);
  return merged;
}

/** 树干：从根部向上逐渐变细，可以带一点弯 */
function trunk({ height, radius, lean = 0, seed, color = '#53412f', taper = 0.32 }) {
  const rnd = mulberry32(seed);
  const dir = rnd() * Math.PI * 2;
  const keys = [];
  const N = 4;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    keys.push({
      p: [Math.cos(dir) * lean * t * t * height, t * height, Math.sin(dir) * lean * t * t * height],
      a: radius * (1 - (1 - taper) * t),
    });
  }
  return makeLoftGeometry({
    keys,
    samples: 6,
    segments: 7,
    jitter: 0.06,
    color,
    capColor: color,
    faceTint: 0.07,
    uvMeters: 0.4,
    seed,
  });
}

/**
 * 层叠圆锥的针叶树（云杉 / 冷杉感）。
 * @param {object} o
 * @param {number} [o.height] 整棵树高
 * @param {number} [o.radius] 最下层树冠半径
 * @param {number} [o.tiers] 树冠层数
 */
export function makeConiferGeometry({
  height = 7,
  radius = 1.5,
  tiers = 4,
  seed = 1,
  palette = { base: '#2f4a2c', tip: '#5d8445' },
} = {}) {
  const rnd = mulberry32(seed * 31 + 5);
  const parts = [trunk({ height: height * 0.42, radius: height * 0.035, seed, taper: 0.45 })];
  const base = toColor(palette.base);
  const tip = toColor(palette.tip);
  const bottom = height * 0.2;
  for (let i = 0; i < tiers; i++) {
    const t = tiers > 1 ? i / (tiers - 1) : 0;
    const r = radius * (1 - t * 0.72) * (0.92 + rnd() * 0.16);
    const h = (height - bottom) * (0.46 - t * 0.14);
    // 最下层从 bottom 起，最上层的锥顶刚好到 height，层与层之间互相重叠
    const y = bottom + (height - bottom - h) * t;
    const cone = new THREE.ConeGeometry(r, h, 7, 1);
    cone.translate(0, h / 2, 0);
    // 下层偏深、针尖偏亮
    const shade = 0.78 + t * 0.3;
    paintByPosition(cone, (x, cy) =>
      base.clone().lerp(tip, THREE.MathUtils.clamp(cy / h, 0, 1) * 0.9).multiplyScalar(shade),
    );
    cone.rotateY(rnd() * Math.PI * 2);
    cone.translate((rnd() - 0.5) * r * 0.1, y, (rnd() - 0.5) * r * 0.1);
    parts.push(cone);
  }
  return combine(parts, 0.07, seed);
}

/**
 * 黄山松：主干矮而弯，几根横展的枝，枝头一簇簇放射状松针。
 * 比针叶林那种"圣诞树"更像照片里的树，用在近景和路边。
 */
export function makeHuangshanPine({ height = 4.2, seed = 1, spread = 2.6 } = {}) {
  const rnd = mulberry32(seed * 17 + 3);
  const parts = [trunk({ height: height * 0.72, radius: height * 0.055, lean: 0.18, seed, color: '#4a3b2f' })];
  const branches = 3 + Math.floor(rnd() * 2);
  const pads = [];
  for (let i = 0; i < branches; i++) {
    const az = (i / branches) * Math.PI * 2 + rnd() * 0.8;
    const y = height * (0.52 + rnd() * 0.4);
    const len = spread * (0.55 + rnd() * 0.5);
    const tipY = y + (rnd() - 0.3) * 0.5;
    // 横展的枝
    parts.push(
      makeLoftGeometry({
        keys: [
          { p: [0, y, 0], a: height * 0.028 },
          { p: [Math.cos(az) * len * 0.55, y + 0.12, Math.sin(az) * len * 0.55], a: height * 0.018 },
          { p: [Math.cos(az) * len, tipY, Math.sin(az) * len], a: height * 0.009 },
        ],
        samples: 6,
        segments: 6,
        jitter: 0.08,
        color: '#4a3b2f',
        faceTint: 0.07,
        uvMeters: 0.3,
        seed: seed * 7 + i,
      }),
    );
    pads.push([Math.cos(az) * len, tipY + 0.06, Math.sin(az) * len, 0.45 + rnd() * 0.3]);
  }
  // 顶部再来一簇
  pads.push([0, height * 0.95, 0, 0.5 + rnd() * 0.25]);
  for (let i = 0; i < pads.length; i++) {
    const [x, y, z, s] = pads[i];
    const pad = makeNeedlePadGeometry(seed * 13 + i, 70, 0.9 * s, {
      base: '#3f5c2b',
      tip: '#88ab5c',
    });
    pad.scale(1, 0.55, 1);
    pad.translate(x, y, z);
    parts.push(pad);
    const core = makeBlobGeometry({
      radius: 0.3 * s,
      detail: 1,
      scale: [1, 0.5, 1],
      jitter: 0.12,
      color: '#3c5229',
      seed: seed + i,
    });
    core.translate(x, y, z);
    parts.push(core);
  }
  return combine(parts, 0, seed);
}

/** 阔叶树：树干 + 几个团块树冠 */
export function makeBroadleafGeometry({ height = 6, seed = 1, palette = ['#4f6b33', '#5c7a39', '#44602c'] } = {}) {
  const rnd = mulberry32(seed * 23 + 7);
  const parts = [trunk({ height: height * 0.55, radius: height * 0.045, lean: 0.12, seed, color: '#5a4836' })];
  const blobs = 3 + Math.floor(rnd() * 2);
  const r0 = height * 0.3;
  for (let i = 0; i < blobs; i++) {
    const az = rnd() * Math.PI * 2;
    const rad = r0 * (0.6 + rnd() * 0.6);
    const d = r0 * 0.55 * rnd();
    const blob = makeBlobGeometry({
      radius: rad,
      detail: 1,
      scale: [1, 0.82, 1],
      jitter: 0.16,
      color: palette[Math.floor(rnd() * palette.length)],
      faceTint: 0.07,
      seed: seed * 5 + i,
    });
    blob.translate(Math.cos(az) * d, height * (0.6 + rnd() * 0.3), Math.sin(az) * d);
    parts.push(blob);
  }
  return combine(parts, 0.05, seed);
}
