import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeMonsterGeo } from './monsterMeshes';

/**
 * 怪物合批：每种怪的零件按粗糙度分组烘焙成一份几何，交给 InstancedMesh 一次画完。
 *
 * 零件表照搬原先的 JSX 层级：root → pre（父 group 位移）→ flip（x 镜像）→ 零件 p / r。
 */

const PI = Math.PI;

/** @typedef {{ g:string, rough:number, p?:number[], r?:number[], pre?:number[], flip?:boolean }} Part */

/** 同一零件左右各一份（第二份套 x 镜像） */
function pair(part) {
  return [part, { ...part, flip: true }];
}

/** @type {Record<string, { root?: number[], parts: Part[] }>} */
export const MONSTER_LAYOUT = {
  pebble: {
    parts: [
      { g: 'shell', p: [0, 0.26, 0], rough: 1 },
      { g: 'plate', p: [0, 0.4, -0.02], rough: 1 },
      { g: 'claw', p: [0.34, 0.16, 0.22], r: [0, -0.35, 0.15], rough: 1 },
      { g: 'claw', p: [-0.34, 0.16, 0.22], r: [0, 0.35, -0.15], rough: 1 },
      { g: 'pincer', p: [0.42, 0.18, 0.34], rough: 0.7 },
      { g: 'pincer', p: [-0.42, 0.18, 0.34], rough: 0.7 },
      { g: 'eye', p: [0.1, 0.34, 0.32], rough: 0.35 },
      { g: 'eye', p: [-0.1, 0.34, 0.32], rough: 0.35 },
      ...pair({ g: 'leg', p: [0.12, 0, 0.12], r: [0, 0.4, 0], rough: 1 }),
      ...pair({ g: 'leg', p: [0.16, 0, 0], rough: 1 }),
      ...pair({ g: 'leg', p: [0.12, 0, -0.12], r: [0, -0.45, 0], rough: 1 }),
    ],
  },
  fox: {
    parts: [
      { g: 'body', p: [0, 0.36, 0], rough: 0.75 },
      { g: 'chest', p: [0, 0.32, 0.22], rough: 0.8 },
      { g: 'head', p: [0, 0.52, 0.32], rough: 0.72 },
      { g: 'muzzle', p: [0, 0.46, 0.48], rough: 0.7 },
      { g: 'nose', p: [0, 0.48, 0.58], rough: 0.4 },
      { g: 'ear', p: [-0.1, 0.7, 0.28], rough: 0.75 },
      { g: 'ear', p: [0.1, 0.7, 0.28], rough: 0.75 },
      { g: 'inner', p: [-0.1, 0.68, 0.3], rough: 0.85 },
      { g: 'inner', p: [0.1, 0.68, 0.3], rough: 0.85 },
      { g: 'tail', rough: 0.8 },
      { g: 'leg', p: [0.12, 0, 0.18], rough: 0.8 },
      { g: 'leg', p: [-0.12, 0, 0.18], rough: 0.8 },
      { g: 'leg', p: [0.12, 0, -0.16], rough: 0.8 },
      { g: 'leg', p: [-0.12, 0, -0.16], rough: 0.8 },
    ],
  },
  crow: {
    parts: [
      { g: 'body', p: [0, 0.62, 0], rough: 0.68 },
      { g: 'head', p: [0, 0.78, 0.22], rough: 0.65 },
      { g: 'beak', p: [0, 0.74, 0.38], rough: 0.4 },
      { g: 'eye', p: [0.06, 0.82, 0.28], rough: 0.3 },
      { g: 'eye', p: [-0.06, 0.82, 0.28], rough: 0.3 },
      ...pair({ g: 'wing', p: [0, 0.62, 0], rough: 0.7 }),
      { g: 'tail', p: [0, 0.55, 0], rough: 0.72 },
      { g: 'leg', p: [0.06, 0.42, 0.04], rough: 0.45 },
      { g: 'leg', p: [-0.06, 0.42, 0.04], rough: 0.45 },
    ],
  },
  titan: {
    parts: [
      { g: 'core', p: [0, 0.95, 0], rough: 0.85 },
      { g: 'plate', p: [0, 1.05, 0.02], rough: 0.75 },
      { g: 'skirt', p: [0, 0.52, 0], rough: 0.9 },
      ...pair({ g: 'pauldron', p: [0.52, 1.22, 0], rough: 0.7 }),
      { g: 'head', p: [0, 1.62, 0.04], rough: 0.72 },
      { g: 'visor', p: [0, 1.58, 0.22], rough: 0.45 },
      { g: 'eye', p: [0.1, 1.62, 0.26], rough: 0.25 },
      { g: 'eye', p: [-0.1, 1.62, 0.26], rough: 0.25 },
      ...pair({ g: 'horn', pre: [0, 1.62, 0], rough: 0.35 }),
      { g: 'spike', pre: [0, 1.62, 0], p: [0, 0.82, -0.06], rough: 0.5 },
      ...pair({ g: 'wing', p: [0.08, 1.05, -0.12], rough: 0.88 }),
      ...pair({ g: 'arm', rough: 0.8 }),
      { g: 'fist', p: [0.86, 0.06, 0.16], rough: 0.75 },
      { g: 'fist', p: [-0.86, 0.06, 0.16], rough: 0.75 },
      ...pair({ g: 'leg', rough: 0.85 }),
    ],
  },
  wyrm: {
    root: [0, PI, 0],
    parts: [
      { g: 'belly', p: [0, 0.62, 0], rough: 0.72 },
      { g: 'spine', p: [0, 1.05, -0.08], rough: 0.65 },
      { g: 'neck', rough: 0.7 },
      { g: 'head', p: [0.1, 1.38, 1.08], rough: 0.65 },
      { g: 'jaw', p: [0.1, 1.18, 1.22], rough: 0.6 },
      { g: 'fang', p: [0.16, 1.12, 1.32], rough: 0.35 },
      { g: 'fang', p: [-0.02, 1.12, 1.32], rough: 0.35 },
      { g: 'eye', p: [0.18, 1.48, 1.18], rough: 0.2 },
      { g: 'eye', p: [-0.02, 1.48, 1.18], rough: 0.2 },
      ...pair({ g: 'horn', pre: [0.1, 1.42, 1.05], rough: 0.55 }),
      ...pair({ g: 'wing', p: [0.06, 0.95, 0.02], rough: 0.78 }),
      { g: 'tail', p: [0, 0.55, 0], rough: 0.75 },
      ...pair({ g: 'claw', p: [0.42, 0.12, 0.38], rough: 0.7 }),
      ...pair({ g: 'leg', p: [0.22, 0, 0.28], rough: 0.8 }),
    ],
  },
  golem: {
    parts: [
      { g: 'torso', p: [0, 0.72, 0], rough: 1 },
      { g: 'belly', p: [0, 0.42, 0.04], rough: 1 },
      { g: 'head', p: [0, 1.18, 0.04], rough: 1 },
      { g: 'eye', p: [0.08, 1.2, 0.16], rough: 0.35 },
      { g: 'eye', p: [-0.08, 1.2, 0.16], rough: 0.35 },
      { g: 'moss', p: [0.16, 0.95, 0.08], rough: 1 },
      ...pair({ g: 'arm', rough: 1 }),
      { g: 'fist', p: [0.68, 0.12, 0.14], rough: 1 },
      { g: 'fist', p: [-0.68, 0.12, 0.14], rough: 1 },
      ...pair({ g: 'leg', rough: 1 }),
    ],
  },
  oni: {
    parts: [
      { g: 'torso', p: [0, 0.72, 0], rough: 0.7 },
      { g: 'sash', p: [0, 0.58, 0.02], rough: 0.85 },
      { g: 'head', p: [0, 1.22, 0.04], rough: 0.65 },
      { g: 'mask', p: [0, 1.2, 0.2], rough: 0.5 },
      { g: 'fang', p: [0.05, 1.06, 0.26], rough: 0.35 },
      { g: 'fang', p: [-0.05, 1.06, 0.26], rough: 0.35 },
      ...pair({ g: 'horn', pre: [0, 1.22, 0], rough: 0.4 }),
      ...pair({ g: 'arm', rough: 0.7 }),
      { g: 'fist', p: [0.54, 0, 0.1], rough: 0.7 },
      { g: 'fist', p: [-0.54, 0, 0.1], rough: 0.7 },
      ...pair({ g: 'leg', rough: 0.75 }),
    ],
  },
};

const KEEP = ['position', 'normal', 'color'];
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
const FLIP = new THREE.Matrix4().makeScale(-1, 1, 1);

function partMatrix(root, part) {
  const m = new THREE.Matrix4();
  if (root) m.makeRotationFromEuler(_e.set(root[0], root[1], root[2]));
  if (part.pre) m.multiply(new THREE.Matrix4().makeTranslation(part.pre[0], part.pre[1], part.pre[2]));
  if (part.flip) m.multiply(FLIP);
  const p = part.p || [0, 0, 0];
  const r = part.r || [0, 0, 0];
  _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  m.multiply(new THREE.Matrix4().compose(_v.set(p[0], p[1], p[2]), _q, ONE));
  return m;
}

/** 非索引几何的三角形绕序翻转（镜像矩阵烘焙进顶点后要补这一步，否则正面会被剔除） */
function flipWinding(geom) {
  for (const name of Object.keys(geom.attributes)) {
    const attr = geom.attributes[name];
    const arr = attr.array;
    const s = attr.itemSize;
    for (let t = 0; t + 2 < attr.count; t += 3) {
      const b = (t + 1) * s;
      const c = (t + 2) * s;
      for (let k = 0; k < s; k++) {
        const tmp = arr[b + k];
        arr[b + k] = arr[c + k];
        arr[c + k] = tmp;
      }
    }
    attr.needsUpdate = true;
  }
}

function bakePart(src, matrix) {
  const g = new THREE.BufferGeometry();
  for (const name of KEEP) {
    if (src.attributes[name]) g.setAttribute(name, src.attributes[name].clone());
  }
  g.applyMatrix4(matrix);
  if (matrix.determinant() < 0) flipWinding(g);
  return g;
}

/**
 * @returns {Record<string, { rough:number, geometry:THREE.BufferGeometry }[]>}
 */
export function buildMonsterBatches(geoByKind = makeMonsterGeo()) {
  const out = {};
  for (const [kind, layout] of Object.entries(MONSTER_LAYOUT)) {
    const geo = geoByKind[kind];
    if (!geo) continue;
    const byRough = new Map();
    for (const part of layout.parts) {
      const src = geo[part.g];
      if (!src) throw new Error(`monster ${kind} 缺零件 ${part.g}`);
      const list = byRough.get(part.rough) || [];
      list.push(bakePart(src, partMatrix(layout.root, part)));
      byRough.set(part.rough, list);
    }
    out[kind] = [...byRough.entries()].map(([rough, list]) => {
      const geometry = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      geometry.computeBoundingSphere();
      return { rough, geometry };
    });
  }
  return out;
}
