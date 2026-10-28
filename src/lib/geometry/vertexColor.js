import * as THREE from 'three';
import { hash3 } from '../math/random';

/**
 * 顶点色工具：低多边形风格的“色块感”主要靠它——
 * 同一个材质（vertexColors）里，每个三角面有一点点明暗差，看起来就像手工上色。
 */

/** 接受 '#rrggbb' / 数字 / THREE.Color，统一返回 THREE.Color（新对象，可放心修改） */
export function toColor(c) {
  return c instanceof THREE.Color ? c.clone() : new THREE.Color(c);
}

/**
 * 给非索引几何体的每个三角面乘一个随机明暗系数。
 * @param {THREE.BufferGeometry} geom 必须是 non-indexed 且已有 color 属性
 * @param {number} amount 明暗幅度，0.06 表示 ±6%
 * @param {number} [seed]
 */
export function applyFaceTint(geom, amount, seed = 1) {
  if (!amount) return geom;
  const pos = geom.attributes.position;
  const col = geom.attributes.color;
  for (let f = 0; f < pos.count; f += 3) {
    // 以三角形重心做哈希，同样的几何永远得到同样的色块
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3;
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    const k = 1 + (hash3(cx * 91.7, cy * 53.1, cz * 71.3, seed) - 0.5) * 2 * amount;
    for (let j = 0; j < 3; j++) {
      col.setXYZ(f + j, col.getX(f + j) * k, col.getY(f + j) * k, col.getZ(f + j) * k);
    }
  }
  col.needsUpdate = true;
  return geom;
}

/** 给几何体整体涂上单色（写入 color 属性） */
export function paintSolid(geom, color) {
  const c = toColor(color);
  const n = geom.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

/**
 * 按顶点位置涂色。
 * @param {THREE.BufferGeometry} geom
 * @param {(x:number,y:number,z:number,i:number)=>THREE.Color|string|number} fn
 */
export function paintByPosition(geom, fn) {
  const pos = geom.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = toColor(fn(pos.getX(i), pos.getY(i), pos.getZ(i), i));
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}
