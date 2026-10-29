import { useMemo } from 'react';
import * as THREE from 'three';
import FacetMesh from '../../../../lib/components/FacetMesh';
import { makeMountainRange } from '../../../../lib/geometry/terrain';
import { applyFaceTint } from '../../../../lib/geometry/vertexColor';
import { fbm2 } from '../../../../lib/math/noise';
import { hash3 } from '../../../../lib/math/random';
import { getGamePerf } from '../../config/perf';
import { BORDER_OUT, HALF, MAP_SIZE, nearestPath, roadFactor, spawnPadFactor, terrainHeight } from './heightfield';

/**
 * 地面网格 + 天际线上的远山。
 *
 * 顶点色按"坡度 / 高程 / 离山路的距离"三件事分：
 *   平地长草、陡坡露岩、高处是裸岩和残雪、路面是压实的土。
 */

const COLORS = {
  grass: new THREE.Color('#5c7246'),
  grassDry: new THREE.Color('#7e8450'),
  rock: new THREE.Color('#79756e'),
  rockHigh: new THREE.Color('#938d85'),
  snow: new THREE.Color('#d8dee2'),
  dirt: new THREE.Color('#8a7256'),
  dirtPale: new THREE.Color('#a08a6c'),
  pad: new THREE.Color('#8d8680'),
  padEdge: new THREE.Color('#6f6a64'),
};

const tmp = new THREE.Color();

function writeTerrainColor(out, offset, x, z, h, eps) {
  const slope = Math.min(
    1,
    (Math.abs(terrainHeight(x + eps, z) - h) + Math.abs(terrainHeight(x, z + eps) - h)) / (eps * 1.6),
  );
  const alt = THREE.MathUtils.smoothstep(h, 14, 34);
  const n = fbm2(x * 0.09, z * 0.09, { seed: 21, octaves: 3 });
  const { dist } = nearestPath(x, z);
  const road = roadFactor(x, z, dist);

  tmp.copy(COLORS.grass).lerp(COLORS.grassDry, n * 0.75);
  tmp.lerp(COLORS.rock, THREE.MathUtils.smoothstep(slope, 0.3, 0.72));
  tmp.lerp(COLORS.rockHigh, alt * 0.8);
  tmp.lerp(COLORS.snow, THREE.MathUtils.smoothstep(h, 30, 44) * (1 - slope * 0.5));
  const dirtMix = (1 - THREE.MathUtils.smoothstep(dist + n * 0.6, 0.9, 2.3)) * THREE.MathUtils.smoothstep(road, 0, 0.3);
  tmp.lerp(COLORS.dirt.clone().lerp(COLORS.dirtPale, n), dirtMix);
  const pad = spawnPadFactor(x, z);
  if (pad > 0.02) tmp.lerp(COLORS.pad.clone().lerp(COLORS.padEdge, 1 - pad), pad);
  tmp.multiplyScalar(0.92 + hash3(Math.floor(x * 3), Math.floor(z * 3), 0, 9) * 0.16);
  out[offset] = tmp.r;
  out[offset + 1] = tmp.g;
  out[offset + 2] = tmp.b;
}

/** 主网格四条边上的顶点（按沿边坐标排好），外圈地形要和它们严丝合缝 */
function edgeIndices(pos, half, which) {
  const eps = 0.05;
  const idx = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const hit =
      (which === 'n' && Math.abs(z - half) < eps) ||
      (which === 's' && Math.abs(z + half) < eps) ||
      (which === 'e' && Math.abs(x - half) < eps) ||
      (which === 'w' && Math.abs(x + half) < eps);
    if (hit) idx.push(i);
  }
  idx.sort((a, b) => (which === 'n' || which === 's' ? pos.getX(a) - pos.getX(b) : pos.getZ(a) - pos.getZ(b)));
  return idx;
}

/**
 * 空气墙外的山坡。内缘直接抄主网格的边，避免接缝裂开；
 * 最外圈再垂下一截裙边，镜头再往外也不会看见地面背面。
 */
function buildBorder(pos, colors, eps) {
  const STEPS = 8;
  const step = BORDER_OUT / STEPS;
  const skirt = 36;
  const dstP = [];
  const dstC = [];
  const dstI = [];

  const pushVert = (x, y, z, r, g, b) => {
    const id = dstP.length / 3;
    dstP.push(x, y, z);
    dstC.push(r, g, b);
    return id;
  };
  const sample = (x, z) => {
    const y = terrainHeight(x, z);
    writeTerrainColor(dstC, dstC.length, x, z, y, eps);
    const id = dstP.length / 3;
    dstP.push(x, y, z);
    return id;
  };

  const addStrip = (edge, axis, sign) => {
    const cols = edge.length;
    const ids = [];
    for (let r = 0; r <= STEPS; r++) {
      for (let c = 0; c < cols; c++) {
        const i = edge[c];
        let x = pos.getX(i);
        let z = pos.getZ(i);
        if (r === 0) {
          ids.push(pushVert(x, pos.getY(i), z, colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]));
        } else {
          const d = step * r;
          if (axis === 'z') z += sign * d;
          else x += sign * d;
          ids.push(sample(x, z));
        }
      }
    }
    for (let r = 0; r < STEPS; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = ids[r * cols + c];
        const b = ids[(r + 1) * cols + c];
        const d = ids[r * cols + c + 1];
        const e = ids[(r + 1) * cols + c + 1];
        dstI.push(a, b, d, b, e, d);
      }
    }
    const outer = [];
    for (let c = 0; c < cols; c++) outer.push(ids[STEPS * cols + c]);
    return outer;
  };

  const addCorner = (x0, z0, signX, signZ) => {
    const ids = [];
    const cols = STEPS + 1;
    for (let j = 0; j <= STEPS; j++) {
      for (let i = 0; i <= STEPS; i++) {
        ids.push(sample(x0 + signX * step * i, z0 + signZ * step * j));
      }
    }
    for (let j = 0; j < STEPS; j++) {
      for (let i = 0; i < STEPS; i++) {
        const a = ids[j * cols + i];
        const b = ids[(j + 1) * cols + i];
        const d = ids[j * cols + i + 1];
        const e = ids[(j + 1) * cols + i + 1];
        dstI.push(a, b, d, b, e, d);
      }
    }
    const farJ = [];
    const farI = [];
    for (let i = 0; i <= STEPS; i++) farJ.push(ids[STEPS * cols + i]);
    for (let j = 0; j <= STEPS; j++) farI.push(ids[j * cols + STEPS]);
    hangSkirt(farJ);
    hangSkirt(farI);
  };

  const hangSkirt = (ids) => {
    for (let c = 0; c < ids.length - 1; c++) {
      const a = ids[c];
      const b = ids[c + 1];
      const ax = dstP[a * 3];
      const ay = dstP[a * 3 + 1];
      const az = dstP[a * 3 + 2];
      const bx = dstP[b * 3];
      const by = dstP[b * 3 + 1];
      const bz = dstP[b * 3 + 2];
      const c0 = pushVert(ax, ay - skirt, az, dstC[a * 3], dstC[a * 3 + 1], dstC[a * 3 + 2]);
      const c1 = pushVert(bx, by - skirt, bz, dstC[b * 3], dstC[b * 3 + 1], dstC[b * 3 + 2]);
      dstI.push(a, c0, b, b, c0, c1);
    }
  };

  const nIdx = edgeIndices(pos, HALF, 'n');
  const sIdx = edgeIndices(pos, HALF, 's');
  const eIdx = edgeIndices(pos, HALF, 'e');
  const wIdx = edgeIndices(pos, HALF, 'w');
  const north = addStrip(nIdx, 'z', 1);
  const south = addStrip(sIdx, 'z', -1);
  const east = addStrip(eIdx, 'x', 1);
  const west = addStrip(wIdx, 'x', -1);
  const at = (i) => [pos.getX(i), pos.getZ(i)];
  const [nex, nez] = at(nIdx[nIdx.length - 1]);
  const [nwx, nwz] = at(nIdx[0]);
  const [sex, sez] = at(sIdx[sIdx.length - 1]);
  const [swx, swz] = at(sIdx[0]);
  addCorner(nex, nez, 1, 1);
  addCorner(nwx, nwz, -1, 1);
  addCorner(sex, sez, 1, -1);
  addCorner(swx, swz, -1, -1);
  hangSkirt(north);
  hangSkirt(south);
  hangSkirt(east);
  hangSkirt(west);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(dstP, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(dstC, 3));
  geo.setIndex(dstI);
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  applyFaceTint(flat, 0.05, 8);
  return flat;
}

function Ground() {
  const geom = useMemo(() => {
    const SEG = getGamePerf().terrainSegments;
    const g = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const eps = MAP_SIZE / SEG;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      writeTerrainColor(colors, i * 3, x, z, h, eps);
    }
    const border = buildBorder(pos, colors, eps);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const nonIdx = g.toNonIndexed();
    g.dispose();
    nonIdx.computeVertexNormals();
    applyFaceTint(nonIdx, 0.05, 4);
    return { inner: nonIdx, border };
  }, []);

  return (
    <>
      <FacetMesh geometry={geom.inner} roughness={1} castShadow={false} />
      <FacetMesh geometry={geom.border} roughness={1} castShadow={false} receiveShadow={false} side={THREE.DoubleSide} />
    </>
  );
}

/** 远山贴在外圈地形后面，近缘只留出大约 2 米，避免和山坡穿插，也避免中间露空 */
const RANGE_PUSH = BORDER_OUT + 19;
const RANGES = [
  {
    pos: [0, -6, -(HALF + RANGE_PUSH)], rotY: 0, depth: 34, seed: 11, color: '#4a6c8c', snow: '#9db6cc',
    peaks: [{ x: -40, h: 58, w: 18 }, { x: 10, h: 48, w: 16 }, { x: 60, h: 54, w: 20 }],
  },
  {
    pos: [0, -6, HALF + RANGE_PUSH], rotY: Math.PI, depth: 34, seed: 12, color: '#56789a', snow: '#a8bed2',
    peaks: [{ x: -30, h: 44, w: 20 }, { x: 30, h: 50, w: 18 }],
  },
  {
    pos: [-(HALF + RANGE_PUSH), -6, 0], rotY: Math.PI / 2, depth: 34, seed: 13, color: '#51738f', snow: '#a2bacf',
    peaks: [{ x: -20, h: 52, w: 20 }, { x: 36, h: 46, w: 18 }],
  },
  {
    pos: [HALF + RANGE_PUSH, -6, 0], rotY: -Math.PI / 2, depth: 34, seed: 14, color: '#5b7d9e', snow: '#aec3d6',
    peaks: [{ x: -34, h: 47, w: 18 }, { x: 24, h: 53, w: 22 }],
  },
];

function FarMountains() {
  const geoms = useMemo(
    () =>
      RANGES.map((r) =>
        makeMountainRange({
          width: 460,
          depth: r.depth,
          segX: 120,
          segZ: 12,
          peaks: r.peaks,
          baseY: 0,
          seed: r.seed,
          color: r.color,
          snowColor: r.snow,
          scale: 0.1,
        }),
      ),
    [],
  );
  return (
    <group>
      {RANGES.map((r, i) => (
        <FacetMesh
          key={i}
          geometry={geoms[i]}
          position={r.pos}
          rotation={[0, r.rotY, 0]}
          tint="#9aa5ad"
          roughness={1}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}

export default function GameTerrain() {
  return (
    <group>
      <Ground />
      <FarMountains />
    </group>
  );
}
