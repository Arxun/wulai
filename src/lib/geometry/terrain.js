import * as THREE from 'three';
import { bump, fbm2, ridged2 } from '../math/noise';
import { applyFaceTint, toColor } from './vertexColor';

/**
 * 程序化地形：把二维噪声堆成高度场，输出平面着色的低多边形网格。
 */

/**
 * 一整排远山（山脊线沿 X 方向展开，z 越小越高，从前往后逐渐隆起，所以从正面看到的是后缘轮廓）。
 * @param {object} o
 * @param {number} o.width X 方向宽度
 * @param {number} o.depth Z 方向进深
 * @param {{x:number,h:number,w:number}[]} o.peaks 主峰（位置 / 高度 / 半宽），决定天际线轮廓
 * @param {number} [o.noiseAmp] 噪声叠加的起伏（相对主峰高度）
 * @param {number} [o.scale] 噪声空间频率
 * @param {number} [o.baseY] 山脚基准高度
 * @param {THREE.ColorRepresentation} o.color 山体底色
 * @param {THREE.ColorRepresentation} [o.snowColor] 山顶亮色（岩石裸露、被雾气洗白）
 */
export function makeMountainRange({
  width = 120,
  depth = 30,
  segX = 90,
  segZ = 16,
  peaks,
  noiseAmp = 0.45,
  scale = 0.09,
  baseY = -12,
  seed = 1,
  color,
  snowColor,
  tint = 0.07,
}) {
  const g = new THREE.PlaneGeometry(width, depth, segX, segZ);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const low = toColor(color).multiplyScalar(0.82);
  const high = toColor(snowColor ?? color);
  let maxH = 0;
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const zt = (depth / 2 - z) / depth; // 0=前缘（靠近相机，+Z）1=后缘（远离相机，-Z）
    let env = 0;
    for (const pk of peaks) env = Math.max(env, pk.h * bump(x, pk.x, pk.w));
    // 越靠后越高；前缘压低，避免挡住近景
    const ramp = Math.pow(zt, 0.7);
    const n = ridged2(x * scale, z * scale * 1.4, { seed, octaves: 5 });
    const f = fbm2(x * scale * 3, z * scale * 3, { seed: seed + 9, octaves: 2 });
    const h = env * ramp * (1 - noiseAmp + noiseAmp * 2 * n) + (f - 0.5) * env * 0.08;
    heights[i] = h;
    maxH = Math.max(maxH, h);
    pos.setY(i, baseY + h + (1 - ramp) * 0);
  }
  g.computeVertexNormals();
  // 顶点色：越高越亮，略带噪声
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = maxH > 0 ? Math.min(1, heights[i] / maxH) : 0;
    tmp.copy(low).lerp(high, Math.pow(t, 1.4));
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  applyFaceTint(flat, tint, seed);
  return flat;
}
