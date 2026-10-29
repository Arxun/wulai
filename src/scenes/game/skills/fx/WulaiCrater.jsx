import { useMemo, useRef } from 'react';
import { useSkillFxWarmupRoot } from '../../debug/useSkillFxWarmupRoot';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FxLight } from '../../fx/FxLight';
import { makeFxBatch } from './fxBatch';
import { MOVES } from '../../../../lib/animation/combatMoves';
import { world } from '../../stores/combatStore';
import { groundMeshHeight } from '../../maps/huangshan/heightfield';

/**
 * 武来砸地后留在落点的深坑：停留 5 秒。
 * 碗状坑壁 + 分叉地裂 + 岩浆柱喷涌。挂在世界里，不跟人走。
 */

const JETS = 36;
const DROPS = 28;
const ROCKS = 22;
const CRACKS = 16;
const FORKS = 14;
const { clamp } = THREE.MathUtils;

function addMat(color, opacity = 0) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function hash(i) {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** 碗状坑：底小、中有台、沿外翻一圈唇 */
function makeBowlGeo() {
  const pts = [
    new THREE.Vector2(0.04, -1.72),
    new THREE.Vector2(0.18, -1.62),
    new THREE.Vector2(0.26, -1.28),
    new THREE.Vector2(0.34, -1.02),
    new THREE.Vector2(0.48, -0.82),
    new THREE.Vector2(0.52, -0.58),
    new THREE.Vector2(0.68, -0.36),
    new THREE.Vector2(0.82, -0.16),
    new THREE.Vector2(0.94, 0.02),
    new THREE.Vector2(1.02, 0.14),
    new THREE.Vector2(1.12, 0.18),
    new THREE.Vector2(1.22, 0.08),
    new THREE.Vector2(1.32, 0.01),
  ];
  const g = new THREE.LatheGeometry(pts, 36);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const a = Math.atan2(z, x);
    const n = Math.sin(a * 7 + y * 4) * 0.018 + Math.sin(a * 13) * 0.01;
    pos.setXYZ(i, x * (1 + n), y + Math.sin(a * 9) * 0.02, z * (1 + n));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** 锯齿地裂：沿 +X 扭着走的一条扁带，可当裂纹或岩浆脉 */
function makeCrackStrip(len, width, segs, seed, taper = 0.72) {
  const pos = [];
  const idx = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    x = t * len;
    z += (hash(seed * 17 + i) - 0.5) * width * 2.8;
    z *= 0.62;
    const w = width * (1.2 - t * taper) * (0.65 + hash(seed + i * 3) * 0.7);
    const bump = (hash(seed * 3 + i) - 0.5) * 0.03;
    pos.push(x, bump, z - w, x, bump, z + w);
    if (i > 0) {
      const a = (i - 1) * 2;
      const b = i * 2;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function ensureBase(geo) {
  if (!geo.userData.base) geo.userData.base = new Float32Array(geo.attributes.position.array);
  return geo.userData.base;
}

/** 把网格按落点附近的可见地面重新铺一遍。sink 是相对地表的高度，负值埋进山里。 */
function writeDraped(geo, ox, oz, lift, map) {
  const base = ensureBase(geo);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const { x, z, sink } = map(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
    pos.setXYZ(i, x, groundMeshHeight(ox + x, oz + z) + sink + lift, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function sit(mesh) {
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
}

export default function WulaiCrater() {
  const root = useRef();
  useSkillFxWarmupRoot(root, { tier: 'ult' });
  const bowl = useRef();
  const pool = useRef();
  const poolHot = useRef();
  const glow = useRef();
  const rim = useRef();
  const rimGlow = useRef();
  const jets = useRef();
  const drops = useRef();
  const rocks = useRef();
  const cracks = useRef();
  const forks = useRef();
  const veins = useRef();
  const forkVeins = useRef();
  const columns = useRef();
  const burst = useRef();
  const light = useRef();
  const light2 = useRef();
  const laid = useRef({ x: NaN, z: NaN, r: NaN, h: 0, rocks: [] });

  const seeds = useMemo(
    () => ({
      jet: Array.from({ length: JETS }, (_, i) => hash(i + 2.1)),
      drop: Array.from({ length: DROPS }, (_, i) => hash(i + 9.4)),
      rock: Array.from({ length: ROCKS }, (_, i) => hash(i + 4.7)),
      crack: Array.from({ length: CRACKS }, (_, i) => i / CRACKS + hash(i + 1.3) * 0.06),
      fork: Array.from({ length: FORKS }, (_, i) => hash(i + 6.2)),
    }),
    [],
  );

  const geo = useMemo(() => {
    const cracks = Array.from({ length: CRACKS }, (_, i) =>
      makeCrackStrip(1, 0.045 + (i % 4) * 0.012, 10 + (i % 3), 11 + i, 0.78),
    );
    const forks = Array.from({ length: FORKS }, (_, i) =>
      makeCrackStrip(1, 0.028 + (i % 3) * 0.01, 7, 40 + i, 0.88),
    );
    return {
      bowl: makeBowlGeo(),
      pool: new THREE.CircleGeometry(1, 32),
      poolHot: new THREE.CircleGeometry(1, 32),
      glow: new THREE.CircleGeometry(1, 28),
      rim: new THREE.RingGeometry(0.98, 1.22, 40),
      rimGlow: new THREE.RingGeometry(0.9, 1.06, 36),
      burst: new THREE.RingGeometry(0.2, 0.55, 20),
      cracks,
      forks,
      veins: cracks.map((g) => g.clone()),
      forkVeins: forks.map((g) => g.clone()),
    };
  }, []);

  const mat = useMemo(
    () => ({
      bowl: new THREE.MeshStandardMaterial({
        color: '#24140c',
        roughness: 0.96,
        metalness: 0.04,
        side: THREE.DoubleSide,
        flatShading: true,
      }),
      pool: addMat('#ff1a06', 0.95),
      poolHot: addMat('#ffe08a', 0.55),
      glow: addMat('#ff6a14', 0.42),
      rim: new THREE.MeshStandardMaterial({
        color: '#3a2214',
        roughness: 0.94,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
      rimGlow: addMat('#ff4a12', 0.35),
      crack: Array.from({ length: CRACKS }, () =>
        new THREE.MeshBasicMaterial({
          color: '#0a0402',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      ),
      fork: Array.from({ length: FORKS }, () =>
        new THREE.MeshBasicMaterial({
          color: '#120806',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      ),
      vein: Array.from({ length: CRACKS }, () => addMat('#ff2a08')),
      forkVein: Array.from({ length: FORKS }, () => addMat('#ff6a18')),
      burst: addMat('#ff8a22', 0.5),
    }),
    [],
  );
  const batch = useMemo(() => {
    const colors = (n, pick) => Array.from({ length: n }, (_, i) => pick(i));
    return {
      jets: makeFxBatch(
        new THREE.TetrahedronGeometry(0.11),
        addMat('#ffffff', 1),
        colors(JETS, (i) => (i % 3 === 0 ? '#ffe08a' : i % 3 === 1 ? '#ff5a12' : '#ff2208')),
        { opacity: 0.95 },
      ),
      drops: makeFxBatch(
        new THREE.SphereGeometry(0.08, 6, 5),
        addMat('#ffffff', 1),
        colors(DROPS, (i) => (i % 2 ? '#ff7a18' : '#ffd056')),
        { opacity: 0.9 },
      ),
      rocks: makeFxBatch(
        new THREE.TetrahedronGeometry(0.2),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, flatShading: true }),
        colors(ROCKS, (i) => (i % 3 ? '#4a2e1a' : '#2e1a10')),
        { alpha: false },
      ),
      columns: makeFxBatch(
        new THREE.CylinderGeometry(0.12, 0.04, 1, 6, 1, true),
        addMat('#ffffff', 1),
        colors(5, (i) => (i % 2 ? '#ff3a0a' : '#ffb428')),
        { opacity: 0.8 },
      ),
    };
  }, []);

  useFrame((state) => {
    const pit = world.crater;
    const on = pit?.on;
    if (root.current) root.current.visible = !!on;
    if (!on) {
      if (light.current) light.current.intensity = 0;
      if (light2.current) light2.current.intensity = 0;
      return;
    }

    const life = MOVES.wulai.craterLife || 5;
    const t = pit.age / life;
    const fade = t > 0.86 ? clamp(1 - (t - 0.86) / 0.14, 0, 1) : 1;
    const clock = state.clock.elapsedTime;
    const pulse = 0.68 + 0.32 * Math.sin(clock * 8.4);
    const burstK = Math.max(0, Math.sin(clock * 3.1));
    const r = pit.r;
    const centerH = groundMeshHeight(pit.x, pit.z);
    root.current.position.set(pit.x, 0, pit.z);

    if (laid.current.x !== pit.x || laid.current.z !== pit.z || laid.current.r !== r) {
      const drapeDisc = (mesh, radius, sink, lift) => {
        if (!mesh) return;
        writeDraped(mesh.geometry, pit.x, pit.z, lift, (x, y) => ({
          x: x * radius,
          z: -y * radius,
          sink,
        }));
        sit(mesh);
      };
      const drapeStrip = (mesh, ang, len, zScale, px, pz, lift) => {
        const theta = -ang;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        writeDraped(mesh.geometry, pit.x, pit.z, lift, (x0, y0, z0) => {
          const x = x0 * len;
          const z = z0 * zScale;
          return { x: px + x * cos + z * sin, z: pz - x * sin + z * cos, sink: y0 };
        });
        sit(mesh);
      };
      if (bowl.current) {
        writeDraped(bowl.current.geometry, pit.x, pit.z, 0.06, (x, y, z) => ({
          x: x * r,
          z: z * r,
          sink: y - 0.18,
        }));
        sit(bowl.current);
      }
      drapeDisc(pool.current, r * 0.3, -1.56, 0.02);
      drapeDisc(poolHot.current, r * 0.16, -1.52, 0.04);
      drapeDisc(glow.current, r * 0.86, 0, 0.05);
      drapeDisc(rim.current, r, 0, 0.07);
      drapeDisc(rimGlow.current, r, 0, 0.09);
      drapeDisc(burst.current, r, 0, 0.12);
      cracks.current?.children.forEach((m, i) => {
        const ang = seeds.crack[i] * Math.PI * 2;
        const len = r * (0.95 + (i % 5) * 0.22 + hash(i + 8) * 0.2);
        drapeStrip(m, ang, len, 1 + (i % 3) * 0.35, Math.cos(ang) * r * 0.22, Math.sin(ang) * r * 0.22, 0.08);
      });
      forks.current?.children.forEach((m, i) => {
        const seed = seeds.fork[i];
        const parent = Math.floor(seed * CRACKS);
        const baseAng = seeds.crack[parent] * Math.PI * 2;
        const ang = baseAng + (seed - 0.5) * 1.1;
        const along = 0.35 + seed * 0.45;
        drapeStrip(m, ang, r * (0.42 + seed * 0.38), 0.9, Math.cos(baseAng) * r * along, Math.sin(baseAng) * r * along, 0.08);
      });
      veins.current?.children.forEach((m, i) => {
        const ang = seeds.crack[i] * Math.PI * 2;
        const len = r * (0.9 + (i % 5) * 0.2);
        drapeStrip(m, ang, len, 0.75, Math.cos(ang) * r * 0.22, Math.sin(ang) * r * 0.22, 0.1);
      });
      forkVeins.current?.children.forEach((m, i) => {
        const seed = seeds.fork[i];
        const parent = Math.floor(seed * CRACKS);
        const baseAng = seeds.crack[parent] * Math.PI * 2;
        const ang = baseAng + (seed - 0.5) * 1.1;
        const along = 0.35 + seed * 0.45;
        drapeStrip(m, ang, r * (0.4 + seed * 0.35), 0.65, Math.cos(baseAng) * r * along, Math.sin(baseAng) * r * along, 0.1);
      });
      laid.current = {
        x: pit.x,
        z: pit.z,
        r,
        h: centerH,
        rocks: seeds.rock.map((seed) => {
          const a = seed * Math.PI * 2;
          const rad = r * (0.88 + seed * 0.38);
          const x = Math.cos(a) * rad;
          const z = Math.sin(a) * rad;
          return {
            x,
            y: groundMeshHeight(pit.x + x, pit.z + z) + 0.1 + seed * 0.22,
            z,
            sx: 0.35 + seed * 0.85,
            sy: 0.22 + seed * 0.4,
            sz: 0.4 + seed * 0.7,
            rot: a + seed,
          };
        }),
      };
    }

    const pulseXZ = (mesh, s) => {
      if (mesh) mesh.scale.set(s, 1, s);
    };
    pulseXZ(pool.current, 0.86 + 0.16 * pulse);
    pulseXZ(poolHot.current, 0.82 + 0.2 * pulse);
    pulseXZ(glow.current, 0.94 + 0.08 * pulse);
    pulseXZ(rimGlow.current, 1 + 0.04 * pulse);
    if (pool.current) pool.current.material.opacity = 0.98 * fade * pulse;
    if (poolHot.current) poolHot.current.material.opacity = 0.7 * fade * pulse;
    if (glow.current) glow.current.material.opacity = 0.38 * fade * pulse;
    if (rimGlow.current) rimGlow.current.material.opacity = 0.32 * fade * pulse;
    cracks.current?.children.forEach((m) => {
      if (m.material) m.material.opacity = 0.82 * fade;
    });
    forks.current?.children.forEach((m) => {
      if (m.material) m.material.opacity = 0.7 * fade;
    });
    veins.current?.children.forEach((m) => {
      if (m.material) m.material.opacity = 0.85 * fade * pulse;
    });
    forkVeins.current?.children.forEach((m) => {
      if (m.material) m.material.opacity = 0.7 * fade * pulse;
    });

    if (columns.current) {
      batch.columns.items.forEach((m, i) => {
        const seed = 0.12 + i * 0.17;
        const a = seed * Math.PI * 2 + clock * 0.15;
        const rad = r * (0.05 + (i % 3) * 0.06);
        const h = (1.4 + (i % 3) * 0.7 + pulse * 0.9 + burstK * 0.8) * fade;
        m.position.set(Math.cos(a) * rad, centerH - 0.38 + h * 0.5, Math.sin(a) * rad);
        m.scale.set(0.7 + pulse * 0.35, h, 0.7 + pulse * 0.35);
        m.opacity = (0.45 + pulse * 0.4) * fade;
      });
      batch.columns.sync();
    }

    if (jets.current) {
      batch.jets.items.forEach((m, i) => {
        const seed = seeds.jet[i];
        const lifeT = (clock * (1.15 + seed * 0.7) + seed) % 1;
        const a = seed * Math.PI * 2;
        const rad = r * (0.04 + seed * 0.22);
        const up = lifeT * (3.4 + seed * 3.8);
        m.position.set(Math.cos(a) * rad, centerH - 1.03 + up, Math.sin(a) * rad);
        m.scale.setScalar((1 - lifeT) * (0.7 + seed * 1.3) * (0.8 + burstK * 0.5));
        m.rotation.x += 0.18;
        m.rotation.z += 0.1;
        m.opacity = (1 - lifeT) * fade;
      });
      batch.jets.sync();
    }

    if (drops.current) {
      batch.drops.items.forEach((m, i) => {
        const seed = seeds.drop[i];
        const lifeT = (clock * (0.7 + seed * 0.45) + seed * 0.6) % 1;
        const a = seed * Math.PI * 2;
        const fly = 0.15 + lifeT * r * (0.35 + seed * 0.45);
        const up = Math.sin(lifeT * Math.PI) * (1.6 + seed * 1.8);
        m.position.set(Math.cos(a) * fly, centerH - 0.18 + up, Math.sin(a) * fly);
        m.scale.setScalar((1 - lifeT * 0.6) * (0.45 + seed * 0.7));
        m.opacity = (1 - lifeT) * 0.9 * fade;
      });
      batch.drops.sync();
    }

    if (burst.current) {
      const s = 0.25 + burstK * 0.55;
      burst.current.scale.set(s, 1, s);
      burst.current.position.y = burstK * 0.35;
      burst.current.material.opacity = 0.55 * burstK * fade;
    }

    if (rocks.current) {
      batch.rocks.items.forEach((m, i) => {
        const p = laid.current.rocks[i];
        if (!p) return;
        m.position.set(p.x, p.y, p.z);
        m.scale.set(p.sx, p.sy, p.sz);
        m.rotation.set(0.25, p.rot, 0.2);
      });
      batch.rocks.sync();
    }

    if (light.current) {
      light.current.intensity = (10 + pulse * 8 + burstK * 6) * fade;
      light.current.position.set(0, centerH + 0.57, 0);
    }
    if (light2.current) {
      light2.current.intensity = (4 + pulse * 3) * fade;
      light2.current.position.set(0, centerH - 0.38, 0);
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={bowl} geometry={geo.bowl} material={mat.bowl} />
      <mesh ref={pool} geometry={geo.pool} material={mat.pool} />
      <mesh ref={poolHot} geometry={geo.poolHot} material={mat.poolHot} />
      <mesh ref={glow} geometry={geo.glow} material={mat.glow} />
      <mesh ref={rim} geometry={geo.rim} material={mat.rim} />
      <mesh ref={rimGlow} geometry={geo.rimGlow} material={mat.rimGlow} />

      <group ref={cracks}>
        {geo.cracks.map((g, i) => (
          <mesh key={i} geometry={g} material={mat.crack[i]} />
        ))}
      </group>
      <group ref={forks}>
        {geo.forks.map((g, i) => (
          <mesh key={i} geometry={g} material={mat.fork[i]} />
        ))}
      </group>
      <group ref={veins}>
        {geo.veins.map((g, i) => (
          <mesh key={i} geometry={g} material={mat.vein[i]} />
        ))}
      </group>
      <group ref={forkVeins}>
        {geo.forkVeins.map((g, i) => (
          <mesh key={i} geometry={g} material={mat.forkVein[i]} />
        ))}
      </group>

      <primitive ref={columns} object={batch.columns.mesh} />
      <mesh ref={burst} geometry={geo.burst} material={mat.burst} />
      <primitive ref={jets} object={batch.jets.mesh} />
      <primitive ref={drops} object={batch.drops.mesh} />
      <primitive ref={rocks} object={batch.rocks.mesh} />

      <FxLight ref={light} color="#ff4a10" intensity={0} distance={18} decay={2} />
      <FxLight ref={light2} color="#ffb428" intensity={0} distance={8} decay={2} />
    </group>
  );
}
