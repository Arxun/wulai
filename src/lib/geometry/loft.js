import * as THREE from 'three';
import { hash3 } from '../math/random';
import { smoothNormals } from './normals';
import { applyFaceTint, toColor } from './vertexColor';

/**
 * 放样（loft）建模：沿一条样条曲线，在每个采样点放一个椭圆截面，再把相邻截面连成面。
 * 手臂、腿、躯干、衣服、靴子、树枝都能用它做，比“胶囊 + 方块”更接近真实体型。
 *
 * 坐标约定：每个截面有局部坐标 (u, v, T)
 *   T = 曲线切线；u = T × ref；v = u × T
 * 默认 ref = +Z：对于竖直的路径，u 就是 +X，v 是 +Z（正前方），
 * 所以 keys 里 a 是“左右半宽”，b 是“前后半厚”。
 * 截面角度 θ 从 u 轴转向 v 轴：θ=0 在 +X，θ=π/2 在 +Z（正前），θ=π 在 -X，θ=3π/2 在背后。
 */

const TAU = Math.PI * 2;

/** 一维 Catmull-Rom，控制点 p0..p3，t∈[0,1] 对应 p1→p2 */
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** 对 keys 的某个数值属性做平滑插值，f 是 [0, n-1] 的浮点下标 */
function sampleScalar(values, f) {
  const n = values.length;
  const i = Math.min(n - 2, Math.max(0, Math.floor(f)));
  const t = f - i;
  const p0 = values[Math.max(0, i - 1)];
  const p1 = values[i];
  const p2 = values[i + 1];
  const p3 = values[Math.min(n - 1, i + 2)];
  return catmull(p0, p1, p2, p3, t);
}

/** 计算截面局部坐标系 */
function frameFor(tangent, ref) {
  const u = new THREE.Vector3().crossVectors(tangent, ref);
  if (u.lengthSq() < 1e-4) u.crossVectors(tangent, new THREE.Vector3(0, 1, 0));
  if (u.lengthSq() < 1e-4) u.crossVectors(tangent, new THREE.Vector3(1, 0, 0));
  u.normalize();
  const v = new THREE.Vector3().crossVectors(u, tangent).normalize();
  return { u, v };
}

/**
 * @typedef {object} LoftKey
 * @property {number[]} p 截面中心 [x,y,z]
 * @property {number} a   u 方向半径
 * @property {number} b   v 方向半径（缺省等于 a）
 */

/**
 * @param {object} o
 * @param {LoftKey[]} o.keys          控制截面（至少 2 个）
 * @param {number} [o.samples]        沿路径的截面数（越少棱角越明显）
 * @param {number} [o.segments]       每个截面的边数
 * @param {number[]} [o.ref]          参考向上方向，默认 [0,0,1]
 * @param {{center:number, half:number|((t:number)=>number)}|null} [o.gap]
 *        在截面上开一道缝（如敞开的外套前襟）。center 是缝中心角度，half 是半宽弧度，可随 t 变化
 * @param {number} [o.thickness]      开口壳体的厚度（只有 gap 时才有内壁）
 * @param {boolean} [o.caps]          封闭截面时是否封两端
 * @param {THREE.ColorRepresentation|((t:number,theta:number)=>THREE.ColorRepresentation)} [o.color]
 * @param {THREE.ColorRepresentation} [o.innerColor] 内壁颜色（衣服里衬）
 * @param {THREE.ColorRepresentation} [o.rimColor]   开口边缘颜色（拉链 / 门襟）
 * @param {THREE.ColorRepresentation} [o.capColor]   封闭截面两端的盖子颜色（原木断面等），缺省同 color
 * @param {number} [o.jitter]         顶点沿径向的随机扰动（相对半径），让轮廓不那么“机械”
 * @param {{count:number, amount:number, phase?:number}} [o.bumps] 沿长度方向的“鼓包”，羽绒服绗缝用
 * @param {(t:number, theta:number)=>number} [o.profile] 额外的径向缩放函数（如肌肉 / 膝盖凸起）
 * @param {number} [o.faceTint]       每个面的明暗随机幅度
 * @param {number} [o.uvMeters]       一张贴图在模型上覆盖的米数（u 绕截面一圈、v 沿路径；配合 RepeatWrapping 的布料贴图）
 * @param {boolean|{crease?:number}} [o.smooth] 算平滑法线（皮肤 / 五官用，配合 FacetMesh 的 smooth）
 * @param {number} [o.seed]
 * @returns {THREE.BufferGeometry} 非索引几何体，带 position / normal / color，适合 flatShading
 */
export function makeLoftGeometry({
  keys,
  samples = 8,
  segments = 8,
  ref = [0, 0, 1],
  gap = null,
  thickness = 0,
  caps = true,
  color = '#cccccc',
  innerColor,
  rimColor,
  capColor,
  jitter = 0,
  bumps,
  profile,
  faceTint = 0.04,
  uvMeters = 0.15,
  smooth = false,
  seed = 1,
}) {
  const n = keys.length;
  const curve = new THREE.CatmullRomCurve3(
    keys.map((k) => new THREE.Vector3(...k.p)),
    false,
    'centripetal',
  );
  const as = keys.map((k) => k.a);
  const bs = keys.map((k) => k.b ?? k.a);
  const refV = new THREE.Vector3(...ref).normalize();
  const colorFn = typeof color === 'function' ? color : () => color;
  const innerC = toColor(innerColor ?? color);
  const rimC = toColor(rimColor ?? innerColor ?? color);
  const shell = !!gap;
  const ringVerts = shell ? segments + 1 : segments;

  const outer = []; // outer[i][j] -> Vector3
  const outerCol = [];
  const inner = [];
  const centers = [];
  const perims = []; // 每个截面的周长（用于 UV）

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    // getPoint 的参数 t 与 keys 下标线性对应，和 sampleScalar 的 f 一致
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const { u, v } = frameFor(tangent, refV);
    const f = t * (n - 1);
    const a = sampleScalar(as, f);
    const b = sampleScalar(bs, f);
    centers.push(center);
    perims.push(TAU * Math.sqrt((a * a + b * b) / 2));

    let bump = 1;
    if (bumps) {
      bump += bumps.amount * (0.5 - 0.5 * Math.cos(TAU * (bumps.count * t + (bumps.phase ?? 0))));
    }

    const half = shell ? (typeof gap.half === 'function' ? gap.half(t) : gap.half) : 0;
    const row = [];
    const rowCol = [];
    const rowIn = [];
    for (let j = 0; j < ringVerts; j++) {
      const theta = shell
        ? gap.center + half + (TAU - 2 * half) * (j / segments)
        : (TAU * j) / segments;
      // 用 (i, j mod segments) 做哈希：封闭截面首尾顶点一致，不会撕裂
      const h = hash3(i * 12.9, (j % segments) * 7.7, 3.1, seed);
      let r = bump * (1 + (h - 0.5) * 2 * jitter);
      if (profile) r *= profile(t, theta);
      const cx = Math.cos(theta);
      const sy = Math.sin(theta);
      row.push(
        center
          .clone()
          .addScaledVector(u, a * r * cx)
          .addScaledVector(v, b * r * sy),
      );
      rowCol.push(toColor(colorFn(t, theta)));
      if (shell && thickness > 0) {
        const ia = Math.max(0.001, a - thickness);
        const ib = Math.max(0.001, b - thickness);
        rowIn.push(
          center
            .clone()
            .addScaledVector(u, ia * r * cx)
            .addScaledVector(v, ib * r * sy),
        );
      }
    }
    outer.push(row);
    outerCol.push(rowCol);
    inner.push(rowIn);
  }

  // 沿路径累计长度（UV 的 v）
  const along = [0];
  for (let i = 1; i < samples; i++) along.push(along[i - 1] + centers[i].distanceTo(centers[i - 1]));
  const halfAt = (i) => (shell ? (typeof gap.half === 'function' ? gap.half(i / (samples - 1)) : gap.half) : 0);
  // 截面 i、第 jr 个顶点（jr 是未取模的原始序号，封闭截面首尾 u 分别是 0 和 1）
  const uvAt = (i, jr) => {
    const frac = shell ? (jr / segments) * ((TAU - 2 * halfAt(i)) / TAU) : jr / segments;
    return [(frac * perims[i]) / uvMeters, along[i] / uvMeters];
  };

  const pos = [];
  const col = [];
  const uvs = [];
  const Z2 = [0, 0];
  const tri = (pa, pb, pc, ca, cb, cc, ua = Z2, ub = Z2, uc = Z2) => {
    pos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, pc.x, pc.y, pc.z);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    uvs.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  };

  // 外表面（按 u×v 为右手系推导的绕序，法线朝外）
  for (let i = 0; i < samples - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const j1 = shell ? j + 1 : (j + 1) % segments;
      const a = outer[i][j];
      const b = outer[i + 1][j];
      const c = outer[i][j1];
      const d = outer[i + 1][j1];
      const ca = outerCol[i][j];
      const cb = outerCol[i + 1][j];
      const cc = outerCol[i][j1];
      const cd = outerCol[i + 1][j1];
      const ua = uvAt(i, j);
      const ub = uvAt(i + 1, j);
      const uc = uvAt(i, j + 1);
      const ud = uvAt(i + 1, j + 1);
      tri(a, b, c, ca, cb, cc, ua, ub, uc);
      tri(b, d, c, cb, cd, cc, ub, ud, uc);
    }
  }

  if (shell && thickness > 0) {
    // 内壁：绕序相反
    for (let i = 0; i < samples - 1; i++) {
      for (let j = 0; j < segments; j++) {
        const a = inner[i][j];
        const b = inner[i + 1][j];
        const c = inner[i][j + 1];
        const d = inner[i + 1][j + 1];
        tri(a, c, b, innerC, innerC, innerC, uvAt(i, j), uvAt(i, j + 1), uvAt(i + 1, j));
        tri(b, c, d, innerC, innerC, innerC, uvAt(i + 1, j), uvAt(i, j + 1), uvAt(i + 1, j + 1));
      }
    }
    // 开口两侧的边缘（门襟）
    for (let i = 0; i < samples - 1; i++) {
      // j=0 一侧
      tri(outer[i][0], inner[i][0], outer[i + 1][0], rimC, rimC, rimC);
      tri(outer[i + 1][0], inner[i][0], inner[i + 1][0], rimC, rimC, rimC);
      // j=segments 一侧（绕序相反）
      const e = segments;
      tri(outer[i][e], outer[i + 1][e], inner[i][e], rimC, rimC, rimC);
      tri(outer[i + 1][e], inner[i + 1][e], inner[i][e], rimC, rimC, rimC);
    }
    // 上下沿
    for (const end of [0, samples - 1]) {
      const start = end === 0;
      for (let j = 0; j < segments; j++) {
        const a = outer[end][j];
        const b = outer[end][j + 1];
        const c = inner[end][j];
        const d = inner[end][j + 1];
        if (start) {
          tri(a, b, c, rimC, rimC, rimC);
          tri(b, d, c, rimC, rimC, rimC);
        } else {
          tri(a, c, b, rimC, rimC, rimC);
          tri(b, c, d, rimC, rimC, rimC);
        }
      }
    }
  } else if (!shell && caps) {
    for (const end of [0, samples - 1]) {
      const start = end === 0;
      const c = centers[end];
      const cc = capColor ? toColor(capColor) : outerCol[end][0];
      for (let j = 0; j < segments; j++) {
        const a = outer[end][j];
        const b = outer[end][(j + 1) % segments];
        const ca = capColor ? cc : outerCol[end][j];
        const cb = capColor ? cc : outerCol[end][(j + 1) % segments];
        if (start) tri(c, a, b, cc, ca, cb);
        else tri(c, b, a, cc, cb, ca);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals(); // 非索引几何体 → 每个面独立法线（平面着色）
  if (smooth) smoothNormals(geom, smooth === true ? undefined : smooth);
  applyFaceTint(geom, faceTint, seed);
  return geom;
}
