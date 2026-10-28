import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../math/random';
import { makeLoftGeometry } from './loft';
import { toColor } from './vertexColor';

/**
 * 程序化头发：在头皮椭球上撒很多“发束”（扁平、尖端收细的弯曲薄片），按区域控制方向和长度。
 * 比一堆圆锥更像真实发型：有层次、有走向、有刘海。
 *
 * 角度约定：方位角 az 从 +X 转向 +Z（az=90° 是正前方，270° 是脑后）；仰角 el 从水平面向上（90° 是头顶）。
 */

const rad = (d) => (d * Math.PI) / 180;

/**
 * @typedef {object} HairRegion
 * @property {number} count 发束数量
 * @property {[number,number]} az 方位角范围（度）
 * @property {[number,number]} el 仰角范围（度）
 * @property {[number,number]} length 长度范围（米）
 * @property {[number,number]} width 宽度范围（米）
 * @property {number[]} flow 发流方向偏置 [x,y,z]（世界坐标，叠加在头皮法线上）
 * @property {number} [lift] 发束离开头皮的程度（0 贴头皮，1 垂直竖起）
 * @property {number} [curl] 末端弯曲量
 * @property {number} [thick] 发束厚度（半厚，默认 0.006）；粗大的发簇用 0.01 左右
 */

/**
 * @param {object} o
 * @param {number[]} o.center 头皮椭球中心
 * @param {number[]} o.radii 椭球半径 [rx, ry, rz]
 * @param {HairRegion[]} o.regions 各区域
 * @param {(az:number, el:number)=>number} [o.hairline] 返回该方位角处允许的最低仰角（度），用来做发际线
 * @param {THREE.ColorRepresentation[]} [o.palette] 发色候选（每束随机选一个，末端会提亮）
 */
export function makeHairGeometry({ center, radii, regions, hairline, palette = ['#14100d', '#1d1611', '#251c15'], seed = 1 }) {
  const rnd = mulberry32(seed);
  const parts = [];
  const c = new THREE.Vector3(...center);
  const pal = palette.map(toColor);

  for (const region of regions) {
    for (let i = 0; i < region.count; i++) {
      const az = rad(region.az[0] + rnd() * (region.az[1] - region.az[0]));
      let elDeg = region.el[0] + rnd() * (region.el[1] - region.el[0]);
      if (hairline) elDeg = Math.max(elDeg, hairline((az * 180) / Math.PI, elDeg));
      const el = rad(elDeg);

      // 头皮上的发根位置与法线
      const root = new THREE.Vector3(
        c.x + radii[0] * Math.cos(el) * Math.cos(az),
        c.y + radii[1] * Math.sin(el),
        c.z + radii[2] * Math.cos(el) * Math.sin(az),
      );
      const normal = new THREE.Vector3(
        (Math.cos(el) * Math.cos(az)) / radii[0],
        Math.sin(el) / radii[1],
        (Math.cos(el) * Math.sin(az)) / radii[2],
      ).normalize();

      const len = region.length[0] + rnd() * (region.length[1] - region.length[0]);
      const wid = region.width[0] + rnd() * (region.width[1] - region.width[0]);
      const lift = region.lift ?? 0.5;
      const thick = region.thick ?? 0.006;
      const flow = new THREE.Vector3(...region.flow).add(
        new THREE.Vector3((rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.35),
      );

      // 方向 = 法线 * lift + 发流；末端再往发流方向弯一点
      const dir = normal.clone().multiplyScalar(lift).add(flow).normalize();
      const curl = region.curl ?? 0.4;
      const mid = root.clone().addScaledVector(dir, len * 0.5).addScaledVector(normal, -0.002);
      const tipDir = dir.clone().addScaledVector(flow, curl).normalize();
      const tip = mid.clone().addScaledVector(tipDir, len * 0.5);

      const base = pal[Math.floor(rnd() * pal.length)];
      const tipColor = base.clone().lerp(new THREE.Color('#3b3028'), 0.3 + rnd() * 0.25);
      const lock = makeLoftGeometry({
        keys: [
          { p: root.clone().addScaledVector(normal, -0.004).toArray(), a: wid * 0.5, b: thick },
          { p: mid.toArray(), a: wid * 0.46, b: thick * 0.92 },
          { p: tip.toArray(), a: wid * 0.04, b: thick * 0.4 },
        ],
        ref: normal.toArray(),
        samples: 4,
        segments: 4,
        color: (t) => base.clone().lerp(tipColor, t * t),
        faceTint: 0.1,
        seed: seed * 1000 + i + Math.floor(len * 1000),
      });
      parts.push(lock);
    }
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}
