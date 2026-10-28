import { hash3 } from './random';

/**
 * 二维噪声工具：value noise / fbm / ridged fbm。
 * 纯函数，种子相同结果必然相同，可用于地形、岩石、树皮等程序化生成。
 */

const smooth = (t) => t * t * (3 - 2 * t);

/** 二维 value noise，输出 [0,1] */
export function valueNoise2(x, y, seed = 1) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash3(xi, yi, 0, seed);
  const b = hash3(xi + 1, yi, 0, seed);
  const c = hash3(xi, yi + 1, 0, seed);
  const d = hash3(xi + 1, yi + 1, 0, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** 分形布朗运动，输出约 [0,1] */
export function fbm2(x, y, { seed = 1, octaves = 4, lacunarity = 2, gain = 0.5 } = {}) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** 山脊噪声：在噪声 0.5 附近形成尖锐山脊，输出 [0,1] */
export function ridged2(x, y, { seed = 1, octaves = 5, lacunarity = 2, gain = 0.5 } = {}) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  let weight = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(valueNoise2(x * freq, y * freq, seed + i * 31) * 2 - 1);
    n *= n;
    n *= weight;
    weight = Math.min(1, Math.max(0, n * 2));
    sum += n * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** 高斯凸起：中心 cx、半宽 w，输出 [0,1] */
export const bump = (x, cx, w) => Math.exp(-(((x - cx) / w) ** 2));
