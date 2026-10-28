import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import FacetMesh from '../../../../lib/components/FacetMesh';
import { makeGrassGeometry, makeRockGeometry } from '../../../../lib/geometry/organic';
import { makeBroadleafGeometry, makeConiferGeometry, makeHuangshanPine } from '../../../../lib/geometry/trees';
import { mulberry32 } from '../../../../lib/math/random';
import { HALF, SPAWN, nearestPath, slopeAt, spawnPadFactor, terrainHeight } from './heightfield';

/**
 * 地图上的植被和石头。
 *
 * 每种物件只生成少数几个"变体"几何体，然后在不同位置重复摆放——
 * 同一份 geometry 在 GPU 上只有一份，几十上百棵树也不会炸显存。
 *
 * 散布规则：离山路太近的不长（否则路被堵住）、太陡的坡不长树、
 * 高海拔只长针叶树、谷底才有阔叶树。
 */

/**
 * 在地图上撒点。
 * @param {object} o
 * @param {number} o.count 目标数量
 * @param {[number,number]} [o.height] 允许的海拔区间
 * @param {number} [o.maxSlope] 允许的最大坡度
 * @param {number} [o.minPath] 离山路的最小距离
 */
function scatter({ count, seed, height = [-99, 99], maxSlope = 0.5, minPath = 4, edge = 6 }) {
  const rnd = mulberry32(seed);
  const out = [];
  const limit = HALF - edge;
  for (let tries = 0; tries < count * 60 && out.length < count; tries++) {
    const x = (rnd() * 2 - 1) * limit;
    const z = (rnd() * 2 - 1) * limit;
    const y = terrainHeight(x, z);
    if (y < height[0] || y > height[1]) continue;
    if (slopeAt(x, z) > maxSlope) continue;
    if (nearestPath(x, z).dist < minPath) continue;
    if (Math.hypot(x - SPAWN[0], z - SPAWN[1]) < 7 || spawnPadFactor(x, z) > 0.15) continue;
    out.push({ x, y, z, rot: rnd() * Math.PI * 2, s: 0.75 + rnd() * 0.55, v: Math.floor(rnd() * 3) });
  }
  return out;
}

/**
 * 一组共用几何体的物件。每种变体一个 InstancedMesh：
 * 几何体在 GPU 上只有一份，100 棵树也是 1 次绘制，地图放大才不会按棵数卡。
 */
function VariantBatch({ items, geometry, roughness, sink, scale, castShadow }) {
  const mesh = useRef();
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      dummy.position.set(it.x, it.y - sink * it.s * scale, it.z);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.setScalar(it.s * scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [items, sink, scale]);

  if (!items.length) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, items.length]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
    >
      <meshStandardMaterial flatShading vertexColors roughness={roughness} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Cluster({ items, variants, roughness = 0.9, sink = 0.15, scale = 1, castShadow = true }) {
  const groups = useMemo(() => {
    const g = variants.map(() => []);
    for (const it of items) g[it.v % variants.length].push(it);
    return g;
  }, [items, variants]);

  return (
    <group>
      {groups.map((list, i) => (
        <VariantBatch
          key={i}
          items={list}
          geometry={variants[i]}
          roughness={roughness}
          sink={sink}
          scale={scale}
          castShadow={castShadow}
        />
      ))}
    </group>
  );
}

export default function Scatter() {
  const geo = useMemo(
    () => ({
      // 针叶林：三个高矮不同的变体
      conifer: [
        makeConiferGeometry({ height: 8.5, radius: 1.9, tiers: 5, seed: 1 }),
        makeConiferGeometry({ height: 6.5, radius: 1.6, tiers: 4, seed: 2, palette: { base: '#2b4530', tip: '#577e42' } }),
        makeConiferGeometry({ height: 10.5, radius: 2.1, tiers: 6, seed: 3, palette: { base: '#334c2b', tip: '#688c48' } }),
      ],
      // 黄山松：路边的近景树
      pine: [
        makeHuangshanPine({ height: 4.6, seed: 5, spread: 3.0 }),
        makeHuangshanPine({ height: 3.6, seed: 6, spread: 2.4 }),
        makeHuangshanPine({ height: 5.4, seed: 7, spread: 3.4 }),
      ],
      // 阔叶树：谷底
      broadleaf: [
        makeBroadleafGeometry({ height: 6.5, seed: 11 }),
        makeBroadleafGeometry({ height: 5.2, seed: 12, palette: ['#5e7a38', '#6b8440', '#50682f'] }),
        makeBroadleafGeometry({ height: 7.5, seed: 13, palette: ['#48612f', '#577038', '#3f5729'] }),
      ],
      rock: [
        makeRockGeometry(31, 0.8, { color: '#7c7872', detail: 1 }),
        makeRockGeometry(32, 0.62, { color: '#8a837a', detail: 1 }),
        makeRockGeometry(33, 0.9, { color: '#6e6b66', detail: 1 }),
      ],
      boulder: [
        makeRockGeometry(41, 0.78, { color: '#767269', detail: 2 }),
        makeRockGeometry(42, 0.66, { color: '#827b71', detail: 2 }),
        makeRockGeometry(43, 0.85, { color: '#6b675f', detail: 2 }),
      ],
    }),
    [],
  );

  const items = useMemo(
    () => ({
      conifer: scatter({ count: 170, seed: 101, height: [4, 38], maxSlope: 0.52, minPath: 5 }),
      pine: scatter({ count: 58, seed: 102, height: [-6, 28], maxSlope: 0.42, minPath: 3.2 }),
      broadleaf: scatter({ count: 68, seed: 103, height: [-16, 10], maxSlope: 0.34, minPath: 4.5 }),
      rock: scatter({ count: 130, seed: 104, maxSlope: 0.85, minPath: 2.6 }),
      boulder: scatter({ count: 36, seed: 105, maxSlope: 0.7, minPath: 4 }),
    }),
    [],
  );

  // 草丛：贴着地面，一簇簇长在缓坡上
  const grass = useMemo(() => {
    const pts = scatter({ count: 1000, seed: 106, maxSlope: 0.4, minPath: 1.8, height: [-16, 32] });
    return makeGrassGeometry(
      pts.map((p) => [p.x, p.y - 0.04, p.z]),
      { blades: 7, height: 0.5, seed: 9, palette: ['#7b8a4a', '#8e9455', '#6b7c3f', '#a2965c'] },
    );
  }, []);

  return (
    <group>
      <Cluster items={items.conifer} variants={geo.conifer} roughness={0.85} sink={0.3} />
      <Cluster items={items.pine} variants={geo.pine} roughness={0.85} sink={0.2} />
      <Cluster items={items.broadleaf} variants={geo.broadleaf} roughness={0.88} sink={0.25} />
      <Cluster items={items.rock} variants={geo.rock} roughness={1} sink={0.3} scale={0.4} castShadow={false} />
      <Cluster items={items.boulder} variants={geo.boulder} roughness={1} sink={0.4} scale={1.5} />
      <FacetMesh geometry={grass} roughness={0.95} castShadow={false} receiveShadow={false} side={2} />
    </group>
  );
}
