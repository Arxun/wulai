import * as THREE from 'three';

/**
 * 给非索引几何体算平滑法线。
 *
 * 非索引几何体直接 computeVertexNormals() 得到的是逐面法线（低多边形的硬棱角）。
 * 这里按顶点位置把共享同一个点的面焊接起来，用面积加权平均它们的法线，
 * 于是同一份顶点色数据既能保留“每面一块色”的手绘感，又能有圆润的明暗过渡。
 * 皮肤、五官这类有机形体用它，衣服 / 岩石保持逐面法线。
 *
 * crease 是折痕阈值（度）：某个面的法线和平均法线夹角超过它时保留自己的法线，
 * 这样鼻翼、耳轮、指甲这些本来就该有硬边的地方不会被抹平。
 *
 * @param {THREE.BufferGeometry} geom 非索引几何体
 * @param {{crease?:number}} [o]
 * @returns {THREE.BufferGeometry} 原几何体（就地修改 normal 属性）
 */
export function smoothNormals(geom, { crease = 75 } = {}) {
  const pos = geom.attributes.position;
  const count = pos.count;
  if (count % 3 !== 0) return geom;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();

  // 面法线（未归一化，长度 ∝ 面积，天然就是面积加权）
  const faceN = new Float32Array(count);
  for (let f = 0; f < count; f += 3) {
    a.fromBufferAttribute(pos, f);
    b.fromBufferAttribute(pos, f + 1);
    c.fromBufferAttribute(pos, f + 2);
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    fn.crossVectors(e1, e2);
    faceN[f] = fn.x;
    faceN[f + 1] = fn.y;
    faceN[f + 2] = fn.z;
  }

  // 按位置分桶累加
  const buckets = new Map();
  const keyOf = (i) =>
    `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const keys = new Array(count);
  for (let i = 0; i < count; i++) {
    const k = keyOf(i);
    keys[i] = k;
    const f = i - (i % 3);
    let acc = buckets.get(k);
    if (!acc) {
      acc = [0, 0, 0];
      buckets.set(k, acc);
    }
    acc[0] += faceN[f];
    acc[1] += faceN[f + 1];
    acc[2] += faceN[f + 2];
  }

  const cosLimit = Math.cos((crease * Math.PI) / 180);
  const avg = new THREE.Vector3();
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const f = i - (i % 3);
    fn.set(faceN[f], faceN[f + 1], faceN[f + 2]);
    if (fn.lengthSq() < 1e-20) fn.set(0, 1, 0);
    else fn.normalize();
    const acc = buckets.get(keys[i]);
    avg.set(acc[0], acc[1], acc[2]);
    const n = avg.lengthSq() > 1e-20 && avg.normalize().dot(fn) >= cosLimit ? avg : fn;
    out[i * 3] = n.x;
    out[i * 3 + 1] = n.y;
    out[i * 3 + 2] = n.z;
  }
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(out, 3));
  return geom;
}
