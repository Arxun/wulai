import * as THREE from 'three';
import { fbm2, valueNoise2 } from '../math/noise';
import { mulberry32 } from '../math/random';

/**
 * 程序化材质贴图：布料 / 皮革 / 皮肤的细节纹理，全部用 canvas 现场生成，不依赖任何图片文件。
 *
 * 每种材质返回 { map, bump }：
 *   map  —— 接近白色的明暗 / 微色偏贴图，与顶点色相乘（保留低多边形的色块感，又多一层织物细节）
 *   bump —— 灰度凹凸，配合 bumpMap 让光线在织纹上有细微起伏
 * 使用时要求几何体带 uv（lib/geometry/loft.js 生成的几何体自带，uvMeters 决定一张贴图覆盖多少米）。
 */

const SIZE = 256;
const cache = new Map();

/**
 * 逐像素生成贴图。
 * @param {(x:number,y:number)=>number[]} pixel 返回 [r,g,b]（0~1）
 */
function paint(pixel, { colorSpace = THREE.SRGBColorSpace, size = SIZE } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const k = (y * size + x) * 4;
      img.data[k] = Math.max(0, Math.min(255, r * 255));
      img.data[k + 1] = Math.max(0, Math.min(255, g * 255));
      img.data[k + 2] = Math.max(0, Math.min(255, b * 255));
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = colorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** 可平铺的噪声（对坐标取模，让贴图首尾相接） */
const tileNoise = (x, y, freq, seed, size = SIZE) => {
  const f = freq;
  const u = (x / size) * f;
  const v = (y / size) * f;
  // 四点混合实现无缝平铺
  const a = valueNoise2(u, v, seed);
  const b = valueNoise2(u - f, v, seed);
  const c = valueNoise2(u, v - f, seed);
  const d = valueNoise2(u - f, v - f, seed);
  const sx = x / size;
  const sy = y / size;
  return a * (1 - sx) * (1 - sy) + b * sx * (1 - sy) + c * (1 - sx) * sy + d * sx * sy;
};

const grey = (v) => [v, v, v];

/** 每种材质的“明暗函数”：返回 0~1 的亮度。map 和 bump 共用同一个函数，保证纹理与凹凸对齐 */
const SHADERS = {
  /** 防撕裂尼龙（羽绒服）：细经纬 + 每隔一段一根粗线 + 揉皱的亮痕 */
  ripstop: (x, y) => {
    const thread = (x % 4 < 2 ? 0.02 : 0) + (y % 4 < 2 ? 0.02 : 0);
    const grid = x % 16 < 1 || y % 16 < 1 ? -0.035 : 0;
    const crinkle = (tileNoise(x, y, 5, 3) - 0.5) * 0.2 + (tileNoise(x, y, 12, 9) - 0.5) * 0.1;
    return 0.92 + thread + grid + crinkle;
  },
  /** 牛津纺 / 水洗衬衫：斜纹 + 纬向浮线 */
  chambray: (x, y) => {
    const twill = ((x + y) % 4) / 4;
    const slub = tileNoise(x, y * 0.25, 40, 5) > 0.72 ? -0.07 : 0;
    const fade = (tileNoise(x, y, 4, 11) - 0.5) * 0.16;
    return 0.86 + twill * 0.1 + slub + fade;
  },
  /** 针织棉 T 恤：细密的小“V”纹 */
  jersey: (x, y) => {
    const v = (x % 3) + (((y + (x % 6 < 3 ? 0 : 1)) % 3) === 0 ? 1 : 0);
    return 0.92 + (v % 2) * 0.05 + (tileNoise(x, y, 8, 2) - 0.5) * 0.06;
  },
  /** 裤子：细斜纹 + 轻微磨白 */
  twill: (x, y) => {
    const t = ((x + 2 * y) % 6) / 6;
    return 0.88 + t * 0.1 + (tileNoise(x, y, 5, 4) - 0.5) * 0.12 + (tileNoise(x, y, 30, 8) - 0.5) * 0.05;
  },
  /** 磨砂皮 / 麂皮靴面：颗粒 + 大块明暗 */
  nubuck: (x, y) => {
    const grain = (tileNoise(x, y, 64, 6) - 0.5) * 0.18;
    const cloud = (tileNoise(x, y, 5, 7) - 0.5) * 0.2;
    const scuff = tileNoise(x, y, 16, 12) > 0.8 ? 0.08 : 0;
    return 0.88 + grain + cloud + scuff;
  },
  /** 帆布 / 背包面料：粗平纹 */
  canvas: (x, y) => {
    const weave = ((x >> 1) + (y >> 1)) % 2 ? 0.06 : 0;
    return 0.86 + weave + (tileNoise(x, y, 8, 13) - 0.5) * 0.1;
  },
  /** 木杖 / 竹节：沿纤维方向的细纹 */
  grain: (x, y) => 0.85 + (tileNoise(x * 0.12, y, 28, 15) - 0.5) * 0.3 + (tileNoise(x, y, 4, 3) - 0.5) * 0.1,
  /** 哑光黑曜石：细划痕 + 磨损斑 */
  obsidian: (x, y) => {
    const scratch = tileNoise(x * 0.15, y, 70, 19) > 0.78 ? -0.16 : 0;
    const scratch2 = tileNoise(x * 0.08, y + x * 0.4, 90, 22) > 0.84 ? -0.1 : 0;
    const pit = tileNoise(x, y, 28, 8) > 0.82 ? -0.08 : 0;
    const cloud = (tileNoise(x, y, 4, 14) - 0.5) * 0.14;
    return 0.62 + cloud + scratch + scratch2 + pit;
  },
};

/** 取一种材质的贴图（带缓存） */
export function fabricTextures(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const fn = SHADERS[kind];
  if (!fn) throw new Error(`未知材质：${kind}`);
  const result = {
    map: paint((x, y) => grey(fn(x, y))),
    bump: paint((x, y) => grey(fn(x, y)), { colorSpace: THREE.NoColorSpace }),
  };
  cache.set(kind, result);
  return result;
}

/**
 * 皮肤贴图：彩色。低频的红 / 黄色斑驳 + 毛孔 + 少量细小斑点，整体接近白色，和顶点肤色相乘。
 * @param {object} [o]
 * @param {number} [o.ruddy] 泛红程度
 */
export function skinTextures({ ruddy = 0.1 } = {}) {
  const key = `skin:${ruddy}`;
  if (cache.has(key)) return cache.get(key);
  const rnd = mulberry32(99);
  // 少量毛孔 / 小痣的位置
  const pores = Array.from({ length: 900 }, () => [Math.floor(rnd() * SIZE), Math.floor(rnd() * SIZE), rnd()]);
  const poreMap = new Map(pores.map(([x, y, s]) => [`${x},${y}`, s]));
  const pixel = (x, y) => {
    const blotch = fbm2(x / 64, y / 64, { seed: 4, octaves: 3 });
    const red = Math.max(0, blotch - 0.45) * 2 * ruddy;
    const yellow = (tileNoise(x, y, 6, 21) - 0.5) * 0.06;
    const pore = poreMap.get(`${x},${y}`);
    const dark = pore !== undefined ? (pore > 0.97 ? 0.16 : 0.05) : 0;
    const fine = (tileNoise(x, y, 90, 17) - 0.5) * 0.04;
    return [1 - dark + fine, 1 - red * 0.9 - dark + yellow + fine, 1 - red * 1.3 - dark - yellow * 0.6 + fine];
  };
  const bumpPixel = (x, y) => {
    const pore = poreMap.get(`${x},${y}`);
    return grey(0.7 + (tileNoise(x, y, 80, 18) - 0.5) * 0.25 - (pore !== undefined ? 0.25 : 0));
  };
  const result = {
    map: paint(pixel),
    bump: paint(bumpPixel, { colorSpace: THREE.NoColorSpace }),
  };
  cache.set(key, result);
  return result;
}
