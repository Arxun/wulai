import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MOVES } from '../../lib/animation/combatMoves';
import { world } from './combatStore';
import { terrainHeight } from './heightfield';

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

export default function WulaiCrater() {
  const root = useRef();
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
      glow: new THREE.CircleGeometry(1, 28),
      rim: new THREE.RingGeometry(0.98, 1.22, 40),
      rimGlow: new THREE.RingGeometry(0.9, 1.06, 36),
      spark: new THREE.TetrahedronGeometry(0.11),
      blob: new THREE.SphereGeometry(0.08, 6, 5),
      shard: new THREE.TetrahedronGeometry(0.2),
      column: new THREE.CylinderGeometry(0.12, 0.04, 1, 6, 1, true),
      burst: new THREE.RingGeometry(0.2, 0.55, 20),
      cracks,
      forks,
      veins: cracks,
      forkVeins: forks,
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
      jet: Array.from({ length: JETS }, (_, i) => addMat(i % 3 === 0 ? '#ffe08a' : i % 3 === 1 ? '#ff5a12' : '#ff2208', 0.95)),
      drop: Array.from({ length: DROPS }, (_, i) => addMat(i % 2 ? '#ff7a18' : '#ffd056', 0.9)),
      rock: Array.from({ length: ROCKS }, (_, i) =>
        new THREE.MeshStandardMaterial({
          color: i % 3 ? '#4a2e1a' : '#2e1a10',
          roughness: 0.92,
          flatShading: true,
        }),
      ),
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
      column: Array.from({ length: 5 }, (_, i) => addMat(i % 2 ? '#ff3a0a' : '#ffb428', 0.8)),
      burst: addMat('#ff8a22', 0.5),
    }),
    [],
  );

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

    root.current.position.set(pit.x, terrainHeight(pit.x, pit.z) + 0.02, pit.z);

    if (bowl.current) bowl.current.scale.set(r, 1, r);
    if (pool.current) {
      const s = r * (0.3 + 0.05 * pulse);
      pool.current.scale.set(s, s, 1);
      pool.current.position.y = -1.58;
      pool.current.material.opacity = 0.98 * fade * pulse;
    }
    if (poolHot.current) {
      const s = r * (0.16 + 0.05 * pulse);
      poolHot.current.scale.set(s, s, 1);
      poolHot.current.position.y = -1.54;
      poolHot.current.material.opacity = 0.7 * fade * pulse;
    }
    if (glow.current) {
      const s = r * (0.86 + 0.08 * pulse);
      glow.current.scale.set(s, s, 1);
      glow.current.material.opacity = 0.38 * fade * pulse;
    }
    if (rim.current) rim.current.scale.set(r, r, 1);
    if (rimGlow.current) {
      rimGlow.current.scale.set(r * (1 + 0.04 * pulse), r * (1 + 0.04 * pulse), 1);
      rimGlow.current.material.opacity = 0.32 * fade * pulse;
    }

    if (cracks.current) {
      cracks.current.children.forEach((m, i) => {
        const ang = seeds.crack[i] * Math.PI * 2;
        const len = r * (0.95 + (i % 5) * 0.22 + hash(i + 8) * 0.2);
        m.position.set(Math.cos(ang) * r * 0.22, 0.03, Math.sin(ang) * r * 0.22);
        m.rotation.set(0, -ang, 0);
        m.scale.set(len, 1, 1 + (i % 3) * 0.35);
        if (m.material) m.material.opacity = 0.82 * fade;
      });
    }
    if (forks.current) {
      forks.current.children.forEach((m, i) => {
        const seed = seeds.fork[i];
        const parent = Math.floor(seed * CRACKS);
        const base = seeds.crack[parent] * Math.PI * 2;
        const ang = base + (seed - 0.5) * 1.1;
        const along = 0.35 + seed * 0.45;
        const len = r * (0.42 + seed * 0.38);
        m.position.set(Math.cos(base) * r * along, 0.032, Math.sin(base) * r * along);
        m.rotation.set(0, -ang, 0);
        m.scale.set(len, 1, 0.9);
        if (m.material) m.material.opacity = 0.7 * fade;
      });
    }
    if (veins.current) {
      veins.current.children.forEach((m, i) => {
        const ang = seeds.crack[i] * Math.PI * 2;
        const len = r * (0.9 + (i % 5) * 0.2);
        m.position.set(Math.cos(ang) * r * 0.22, 0.045, Math.sin(ang) * r * 0.22);
        m.rotation.set(0, -ang, 0);
        m.scale.set(len, 1, 0.55 + pulse * 0.35);
        if (m.material) m.material.opacity = 0.85 * fade * pulse;
      });
    }
    if (forkVeins.current) {
      forkVeins.current.children.forEach((m, i) => {
        const seed = seeds.fork[i];
        const parent = Math.floor(seed * CRACKS);
        const base = seeds.crack[parent] * Math.PI * 2;
        const ang = base + (seed - 0.5) * 1.1;
        const along = 0.35 + seed * 0.45;
        m.position.set(Math.cos(base) * r * along, 0.048, Math.sin(base) * r * along);
        m.rotation.set(0, -ang, 0);
        m.scale.set(r * (0.4 + seed * 0.35), 1, 0.5 + pulse * 0.3);
        if (m.material) m.material.opacity = 0.7 * fade * pulse;
      });
    }

    if (columns.current) {
      columns.current.children.forEach((m, i) => {
        const seed = 0.12 + i * 0.17;
        const a = seed * Math.PI * 2 + clock * 0.15;
        const rad = r * (0.05 + (i % 3) * 0.06);
        const h = (1.4 + (i % 3) * 0.7 + pulse * 0.9 + burstK * 0.8) * fade;
        m.position.set(Math.cos(a) * rad, -0.4 + h * 0.5, Math.sin(a) * rad);
        m.scale.set(0.7 + pulse * 0.35, h, 0.7 + pulse * 0.35);
        if (m.material) m.material.opacity = (0.45 + pulse * 0.4) * fade;
      });
    }

    if (jets.current) {
      jets.current.children.forEach((m, i) => {
        const seed = seeds.jet[i];
        const lifeT = (clock * (1.15 + seed * 0.7) + seed) % 1;
        const a = seed * Math.PI * 2;
        const rad = r * (0.04 + seed * 0.22);
        const up = lifeT * (3.4 + seed * 3.8);
        m.position.set(Math.cos(a) * rad, -1.05 + up, Math.sin(a) * rad);
        m.scale.setScalar((1 - lifeT) * (0.7 + seed * 1.3) * (0.8 + burstK * 0.5));
        m.rotation.x += 0.18;
        m.rotation.z += 0.1;
        if (m.material) m.material.opacity = (1 - lifeT) * fade;
      });
    }

    if (drops.current) {
      drops.current.children.forEach((m, i) => {
        const seed = seeds.drop[i];
        const lifeT = (clock * (0.7 + seed * 0.45) + seed * 0.6) % 1;
        const a = seed * Math.PI * 2;
        const fly = 0.15 + lifeT * r * (0.35 + seed * 0.45);
        const up = Math.sin(lifeT * Math.PI) * (1.6 + seed * 1.8);
        m.position.set(Math.cos(a) * fly, -0.2 + up, Math.sin(a) * fly);
        m.scale.setScalar((1 - lifeT * 0.6) * (0.45 + seed * 0.7));
        if (m.material) m.material.opacity = (1 - lifeT) * 0.9 * fade;
      });
    }

    if (burst.current) {
      const s = r * (0.25 + burstK * 0.55);
      burst.current.scale.set(s, s, 1);
      burst.current.position.y = 0.12 + burstK * 0.35;
      burst.current.material.opacity = 0.55 * burstK * fade;
    }

    if (rocks.current) {
      rocks.current.children.forEach((m, i) => {
        const seed = seeds.rock[i];
        const a = seed * Math.PI * 2;
        const rad = r * (0.88 + seed * 0.38);
        m.position.set(Math.cos(a) * rad, 0.06 + seed * 0.28, Math.sin(a) * rad);
        m.scale.set(0.35 + seed * 0.85, 0.22 + seed * 0.4, 0.4 + seed * 0.7);
        m.rotation.set(0.25, a + seed, 0.2);
      });
    }

    if (light.current) {
      light.current.intensity = (10 + pulse * 8 + burstK * 6) * fade;
      light.current.position.set(0, 0.55, 0);
    }
    if (light2.current) {
      light2.current.intensity = (4 + pulse * 3) * fade;
      light2.current.position.set(0, -0.4, 0);
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={bowl} geometry={geo.bowl} material={mat.bowl} />
      <mesh ref={pool} geometry={geo.pool} material={mat.pool} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh ref={poolHot} geometry={geo.pool} material={mat.poolHot} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh ref={glow} geometry={geo.glow} material={mat.glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} />
      <mesh ref={rim} geometry={geo.rim} material={mat.rim} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} />
      <mesh ref={rimGlow} geometry={geo.rimGlow} material={mat.rimGlow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} />

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

      <group ref={columns}>
        {mat.column.map((m, i) => (
          <mesh key={i} geometry={geo.column} material={m} />
        ))}
      </group>
      <mesh ref={burst} geometry={geo.burst} material={mat.burst} rotation={[-Math.PI / 2, 0, 0]} />
      <group ref={jets}>
        {mat.jet.map((m, i) => (
          <mesh key={i} geometry={geo.spark} material={m} />
        ))}
      </group>
      <group ref={drops}>
        {mat.drop.map((m, i) => (
          <mesh key={i} geometry={geo.blob} material={m} />
        ))}
      </group>
      <group ref={rocks}>
        {mat.rock.map((m, i) => (
          <mesh key={i} geometry={geo.shard} material={m} />
        ))}
      </group>

      <pointLight ref={light} color="#ff4a10" intensity={0} distance={18} decay={2} />
      <pointLight ref={light2} color="#ffb428" intensity={0} distance={8} decay={2} />
    </group>
  );
}
