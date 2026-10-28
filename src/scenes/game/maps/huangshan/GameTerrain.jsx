import { useMemo } from 'react';
import * as THREE from 'three';
import FacetMesh from '../../../../lib/components/FacetMesh';
import { makeMountainRange } from '../../../../lib/geometry/terrain';
import { applyFaceTint } from '../../../../lib/geometry/vertexColor';
import { fbm2 } from '../../../../lib/math/noise';
import { hash3 } from '../../../../lib/math/random';
import { HALF, MAP_SIZE, nearestPath, roadFactor, spawnPadFactor, terrainHeight } from './heightfield';

/**
 * 地面网格 + 天际线上的远山。
 *
 * 顶点色按"坡度 / 高程 / 离山路的距离"三件事分：
 *   平地长草、陡坡露岩、高处是裸岩和残雪、路面是压实的土。
 */

const SEG = 200; // 260m / 200 = 1.3m 一格。格子不必跟地图等比涨，不然顶点数会按面积平方往上窜

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

function Ground() {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    const eps = MAP_SIZE / SEG;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);

      // 坡度：和邻格的高差
      const slope = Math.min(
        1,
        (Math.abs(terrainHeight(x + eps, z) - h) + Math.abs(terrainHeight(x, z + eps) - h)) / (eps * 1.6),
      );
      const alt = THREE.MathUtils.smoothstep(h, 14, 34);
      const n = fbm2(x * 0.09, z * 0.09, { seed: 21, octaves: 3 });
      const { dist } = nearestPath(x, z);
      const road = roadFactor(x, z, dist);

      // 草 → 枯草 → 岩石 → 高山裸岩 → 雪
      tmp.copy(COLORS.grass).lerp(COLORS.grassDry, n * 0.75);
      tmp.lerp(COLORS.rock, THREE.MathUtils.smoothstep(slope, 0.3, 0.72));
      tmp.lerp(COLORS.rockHigh, alt * 0.8);
      tmp.lerp(COLORS.snow, THREE.MathUtils.smoothstep(h, 30, 44) * (1 - slope * 0.5));
      // 路面：压实的土，中间更亮（踩得多）。
      // 土色按"离路中线的距离"上，比压平的范围（ROAD_FADE）窄得多：
      // 路肩要平滑过渡地形，但不能把土色糊出去一大片。噪声让边缘不是一条直尺
      const dirtMix = (1 - THREE.MathUtils.smoothstep(dist + n * 0.6, 0.9, 2.3)) * THREE.MathUtils.smoothstep(road, 0, 0.3);
      tmp.lerp(COLORS.dirt.clone().lerp(COLORS.dirtPale, n), dirtMix);
      const pad = spawnPadFactor(x, z);
      if (pad > 0.02) tmp.lerp(COLORS.pad.clone().lerp(COLORS.padEdge, 1 - pad), pad);
      // 零星的明暗
      tmp.multiplyScalar(0.92 + hash3(Math.floor(x * 3), Math.floor(z * 3), 0, 9) * 0.16);

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const nonIdx = g.toNonIndexed();
    g.dispose();
    nonIdx.computeVertexNormals();
    applyFaceTint(nonIdx, 0.05, 4);
    return nonIdx;
  }, []);

  return <FacetMesh geometry={geom} roughness={1} castShadow={false} />;
}

/** 天际线：地图外围再摆四层远山，把边界藏掉 */
const RANGES = [
  {
    pos: [0, -6, -HALF - 30], rotY: 0, depth: 34, seed: 11, color: '#4a6c8c', snow: '#9db6cc',
    peaks: [{ x: -40, h: 58, w: 18 }, { x: 10, h: 48, w: 16 }, { x: 60, h: 54, w: 20 }],
  },
  {
    pos: [0, -6, HALF + 30], rotY: Math.PI, depth: 34, seed: 12, color: '#56789a', snow: '#a8bed2',
    peaks: [{ x: -30, h: 44, w: 20 }, { x: 30, h: 50, w: 18 }],
  },
  {
    pos: [-HALF - 30, -6, 0], rotY: Math.PI / 2, depth: 34, seed: 13, color: '#51738f', snow: '#a2bacf',
    peaks: [{ x: -20, h: 52, w: 20 }, { x: 36, h: 46, w: 18 }],
  },
  {
    pos: [HALF + 30, -6, 0], rotY: -Math.PI / 2, depth: 34, seed: 14, color: '#5b7d9e', snow: '#aec3d6',
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
