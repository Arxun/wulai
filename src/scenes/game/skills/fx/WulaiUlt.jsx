import { useMemo, useRef } from 'react';
import { useSkillFxWarmupRoot } from '../../debug/useSkillFxWarmupRoot';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { movePose, moveProgress } from '../../../../lib/animation/combatMoves';
import { ZERO_POSE } from '../../../../lib/animation/gait';
import Person from '../../../lowpoly/person/index';
import { LOCO_RIG } from '../../../lowpoly/person/rigs';
import { world } from '../../stores/combatStore';

/**
 * 大招「武来」：底层地裂岩浆，中层金红冲击波，上层蓝紫电弧 / 灵屑。
 * 粒子全是 ADD。挂在玩家身上，角色面朝 +Z，法相是身后独立的 8 倍虚影。
 */

const RISE = 40;
const BURST = 32;
const LAVA = 26;
const ROCK = 18;
const ARCS = 8;
const BODY_ARCS = 6;
const CRACKS = 10;
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

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

function boltBetween(mesh, ax, ay, az, bx, by, bz, fat) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 0.01;
  mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  mesh.scale.set(fat, len, fat);
  _dir.set(dx, dy, dz).normalize();
  mesh.quaternion.setFromUnitVectors(_up, _dir);
}

export default function WulaiUlt() {
  const root = useRef();
  useSkillFxWarmupRoot(root);
  const avatar = useRef();
  const ring = useRef();
  const ringPurp = useRef();
  const wave = useRef();
  const waveInner = useRef();
  const trail = useRef();
  const glow = useRef();
  const light = useRef();
  const lightArc = useRef();
  const rise = useRef();
  const burst = useRef();
  const lava = useRef();
  const rock = useRef();
  const arcs = useRef();
  const bodyArcs = useRef();
  const cracks = useRef();
  const magma = useRef();
  const web = useRef();
  const poseRef = useRef(ZERO_POSE);

  const seeds = useMemo(
    () => ({
      rise: Array.from({ length: RISE }, () => Math.random()),
      burst: Array.from({ length: BURST }, () => Math.random()),
      lava: Array.from({ length: LAVA }, () => Math.random()),
      rock: Array.from({ length: ROCK }, () => Math.random()),
      crack: Array.from({ length: CRACKS }, (_, i) => i / CRACKS + Math.random() * 0.04),
    }),
    [],
  );
  const geo = useMemo(
    () => ({
      shard: new THREE.TetrahedronGeometry(0.08),
      spark: new THREE.TetrahedronGeometry(0.045),
      bolt: new THREE.BoxGeometry(1, 1, 1),
      ring: new THREE.RingGeometry(0.65, 1.08, 40),
      wave: new THREE.RingGeometry(0.32, 0.7, 42),
      trail: new THREE.TorusGeometry(1, 0.05, 6, 36),
      glow: new THREE.SphereGeometry(0.55, 10, 8),
      crack: new THREE.PlaneGeometry(1, 0.11),
      magma: new THREE.PlaneGeometry(1, 0.045),
      web: new THREE.RingGeometry(0.92, 1.05, 40),
    }),
    [],
  );
  const mat = useMemo(
    () => ({
      gold: addMat('#ffe08a'),
      ember: addMat('#ff7a22'),
      purp: addMat('#8a6dff'),
      wave: addMat('#fff1b0'),
      rise: Array.from({ length: RISE }, (_, i) => addMat(i % 3 === 0 ? '#9a7cff' : '#ffd056', 0.85)),
      burst: Array.from({ length: BURST }, (_, i) => addMat(i % 2 ? '#c8b4ff' : '#ffe08a', 0.9)),
      lavaBits: Array.from({ length: LAVA }, () => addMat('#ff2a0a', 0.9)),
      rocks: Array.from({ length: ROCK }, () => addMat('#8a5a32', 0.75)),
      arc: Array.from({ length: ARCS }, (_, i) => addMat(i % 2 ? '#b8a6ff' : '#7d5cff', 0.7)),
      body: Array.from({ length: BODY_ARCS }, () => addMat('#8a6dff', 0.4)),
      crack: Array.from({ length: CRACKS }, () => new THREE.MeshBasicMaterial({
        color: '#140806',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })),
      magma: Array.from({ length: CRACKS }, () => addMat('#ff2a0a')),
      web: Array.from({ length: 4 }, () => new THREE.MeshBasicMaterial({
        color: '#1a0806',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })),
    }),
    [],
  );

  useFrame((state) => {
    const on = world.move === 'wulai';
    if (root.current) root.current.visible = on;
    if (!on) {
      if (light.current) light.current.intensity = 0;
      if (lightArc.current) lightArc.current.intensity = 0;
      if (avatar.current) avatar.current.visible = false;
      return;
    }

    const t = moveProgress(world);
    const sec = t * 3;
    const clock = state.clock.elapsedTime;
    poseRef.current = movePose('wulai', t);

    const p1 = sec >= 0.4 && sec < 1.05 ? (sec < 0.78 ? clamp((sec - 0.4) / 0.28, 0, 1) : clamp(1 - (sec - 0.78) / 0.27, 0, 1)) : 0;
    const p2 = sec >= 0.9 ? clamp((sec - 0.9) / 0.7, 0, 1) : 0;
    const p3 = sec >= 1.85 && sec <= 2.4 ? (sec - 1.85) / 0.55 : 0;
    const slamFlash = sec >= 1.82 && sec < 2.05 ? clamp(1 - Math.abs(sec - 1.88) / 0.1, 0, 1) : 0;
    const p4 = sec > 2.4 ? clamp((sec - 2.4) / 0.6, 0, 1) : 0;
    const crackK = sec < 2.4 ? clamp((sec - 0.95) / 0.8, 0, 1) * (sec >= 1.6 ? 1 : 0.55) : 1 - p4;
    const breath = 0.72 + 0.28 * Math.sin(clock * 6.2);

    if (avatar.current) {
      const show = sec >= 0.9;
      avatar.current.visible = show;
      if (show) {
        const solid = sec < 2.4 ? 0.16 + 0.28 * p2 * breath : 0.44 * (1 - p4) * (1 - p4);
        const grow = sec < 1.6 ? 4.6 + 3.4 * p2 : 8;
        avatar.current.scale.setScalar(grow);
        avatar.current.position.set(0, 0, -1.55 - (1 - p2) * 1.1);
        const gold = breath > 0.92;
        avatar.current.children.forEach((child) => {
          if (child === arcs.current) return;
          child.traverse((o) => {
            if (!o.isMesh || !o.material || o.material.opacity === undefined) return;
            o.material.opacity = solid;
            o.material.color.set(gold ? '#ffefb0' : '#ff6a28');
          });
        });
      }
    }

    if (ring.current) {
      ring.current.visible = p1 > 0.02 || (p3 > 0 && p3 < 0.4);
      const s = 1.1 + p1 * 5.4 + p3 * 1.6;
      ring.current.scale.set(s, s, 1);
      ring.current.material.opacity = Math.max(p1, p3 * 0.25, slamFlash) * 0.75 * breath;
    }
    if (ringPurp.current) {
      ringPurp.current.visible = p1 > 0.02;
      const s = 0.85 + p1 * 4.6;
      ringPurp.current.scale.set(s, s, 1);
      ringPurp.current.material.opacity = p1 * 0.55;
      ringPurp.current.rotation.z = clock * 2.2;
    }

    const waveR = world.waveR || 0;
    if (wave.current) {
      wave.current.visible = p3 > 0.01 || (p4 > 0 && p4 < 0.7);
      const r = p3 > 0 ? waveR : waveR * (1 - p4);
      wave.current.scale.set(Math.max(r, 0.4), Math.max(r, 0.4), 1);
      wave.current.material.opacity = p3 > 0 ? clamp(0.9 - p3 * 0.55, 0.2, 0.9) : 0.35 * (1 - p4);
    }
    if (waveInner.current) {
      waveInner.current.visible = p3 > 0.01;
      const r = Math.max(waveR * 0.72, 0.3);
      waveInner.current.scale.set(r, r, 1);
      waveInner.current.material.opacity = 0.4 * (1 - p3);
    }
    if (trail.current) {
      trail.current.visible = p3 > 0.02;
      const r = Math.max(waveR * 0.9, 0.5);
      trail.current.scale.set(r, r, 1);
      trail.current.rotation.z = clock * 2.4;
      trail.current.material.opacity = 0.5 * (1 - p3);
    }

    if (glow.current) {
      glow.current.visible = sec >= 0.4;
      glow.current.scale.setScalar((0.7 + p1 * 2.6 + p2 * 1.4 + p3 * 0.8) * breath);
      glow.current.material.opacity = (0.16 + p1 * 0.4 + p2 * 0.1) * (1 - p4);
    }

    if (cracks.current) {
      cracks.current.visible = crackK > 0.02;
      cracks.current.children.forEach((m, i) => {
        const ang = seeds.crack[i] * Math.PI * 2;
        const len = 1.2 + crackK * (6.5 + (i % 3) * 1.4);
        m.position.set(Math.cos(ang) * len * 0.5, 0.025, Math.sin(ang) * len * 0.5);
        m.rotation.set(-Math.PI / 2, 0, ang);
        m.scale.set(len, 1 + (i % 2) * 0.4, 1);
        if (m.material) m.material.opacity = 0.55 * crackK;
      });
    }
    if (web.current) {
      web.current.visible = crackK > 0.02;
      web.current.children.forEach((m, i) => {
        const r = 1.2 + crackK * (2.4 + i * 2.3);
        m.scale.set(r, r, 1);
        if (m.material) m.material.opacity = 0.32 * crackK;
      });
    }
    if (magma.current) {
      magma.current.visible = (p3 > 0.02 || (p2 > 0.4 && sec < 2.4) || p4 > 0) && crackK > 0.05;
      magma.current.children.forEach((m, i) => {
        const ang = seeds.crack[i] * Math.PI * 2;
        const len = 1.0 + crackK * (6.2 + (i % 3) * 1.2);
        m.position.set(Math.cos(ang) * len * 0.5, 0.04, Math.sin(ang) * len * 0.5);
        m.rotation.set(-Math.PI / 2, 0, ang);
        m.scale.set(len, 0.7 + breath * 0.5, 1);
        if (m.material) m.material.opacity = (p3 > 0 ? 0.85 : 0.35) * crackK * breath;
      });
    }

    if (rise.current) {
      rise.current.visible = sec >= 0.85 && sec < 2.85;
      rise.current.children.forEach((m, i) => {
        const seed = seeds.rise[i];
        const life = (clock * 0.7 + seed) % 1;
        const a = seed * Math.PI * 2;
        const rad = 0.35 + seed * 1.25;
        m.position.set(Math.cos(a) * rad, life * 4.2 * Math.max(p2, 0.15), Math.sin(a) * rad - 0.7);
        m.scale.setScalar((1 - life) * (0.35 + seed) * (1 - p4));
        if (m.material) m.material.opacity = (1 - life) * (0.7 + seed * 0.3) * (1 - p4);
      });
    }

    if (burst.current) {
      burst.current.visible = p1 > 0.02;
      burst.current.children.forEach((m, i) => {
        const seed = seeds.burst[i];
        const a = seed * Math.PI * 2;
        const rad = 0.25 + p1 * (2.2 + seed * 2.8);
        m.position.set(Math.cos(a) * rad, 0.1 + seed * 0.55, Math.sin(a) * rad);
        m.scale.setScalar((1 - p1 * 0.35) * (0.45 + seed));
        if (m.material) m.material.opacity = (1 - p1 * 0.2) * 0.9;
      });
    }

    if (lava.current) {
      lava.current.visible = p3 > 0.05 || (p4 > 0 && p4 < 0.55);
      const k = p3 > 0 ? p3 : 1 - p4;
      lava.current.children.forEach((m, i) => {
        const seed = seeds.lava[i];
        const a = seed * Math.PI * 2;
        const rad = 0.6 + k * (5.5 + seed * 4);
        const up = Math.sin(k * Math.PI) * (0.4 + seed * 1.6);
        m.position.set(Math.cos(a) * rad, 0.08 + up, Math.sin(a) * rad);
        m.scale.setScalar((0.5 + seed) * (1 - k * 0.3));
        m.rotation.x += 0.1;
      });
    }

    if (rock.current) {
      rock.current.visible = p3 > 0.06;
      rock.current.children.forEach((m, i) => {
        const seed = seeds.rock[i];
        const a = seed * Math.PI * 2 + 0.4;
        const rad = 0.5 + p3 * (4.2 + seed * 3.5);
        m.position.set(Math.cos(a) * rad, 0.12 + (1 - seed) * 0.9 * (1 - p3), Math.sin(a) * rad);
        m.scale.setScalar((1 - p3) * (0.7 + seed));
        m.rotation.y += 0.07;
      });
    }

    const flicker = Math.sin(clock * 38) > -0.15;
    if (arcs.current) {
      const show = sec >= 0.9 && sec < 2.85 && flicker;
      arcs.current.visible = show;
      if (show) {
        arcs.current.children.forEach((m, i) => {
          const a0 = clock * (2.1 + i * 0.17) + i;
          const a1 = a0 + 0.7 + (i % 3) * 0.4;
          const y0 = 0.45 + (i % 4) * 0.32;
          const y1 = y0 + 0.35 * Math.sin(clock * 9 + i);
          const r0 = 0.22 + (i % 3) * 0.12;
          const r1 = 0.2 + ((i + 1) % 3) * 0.12;
          boltBetween(m, Math.cos(a0) * r0, y0, Math.sin(a0) * r0, Math.cos(a1) * r1, y1, Math.sin(a1) * r1, 0.018 + (i % 2) * 0.01);
          if (m.material) m.material.opacity = 0.55 + 0.4 * Math.sin(clock * 24 + i);
        });
      }
    }

    if (bodyArcs.current) {
      const show = sec >= 0.4 && sec < 2.95 && flicker;
      bodyArcs.current.visible = show;
      if (show) {
        bodyArcs.current.children.forEach((m, i) => {
          const a0 = clock * 4 + i * 1.1;
          const a1 = a0 + 0.9;
          boltBetween(
            m,
            Math.cos(a0) * 0.28,
            0.55 + (i % 3) * 0.38,
            Math.sin(a0) * 0.22,
            Math.cos(a1) * 0.32,
            0.7 + ((i + 1) % 3) * 0.32,
            Math.sin(a1) * 0.24,
            0.012,
          );
          if (m.material) m.material.opacity = 0.35 + p1 * 0.4;
        });
      }
    }

    if (light.current) {
      light.current.position.set(0, 2.6, 0.3);
      light.current.intensity = 4 + p1 * 12 + p2 * 7 + p3 * 20 + slamFlash * 18;
      light.current.color.set(p3 > 0.05 ? '#ff7a2a' : '#ffd056');
    }
    if (lightArc.current) {
      lightArc.current.position.set(0, 6, -1.2);
      lightArc.current.intensity = (sec >= 0.9 ? 6 + breath * 4 : 0) * (1 - p4);
    }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={cracks}>
        {seeds.crack.map((_, i) => (
          <mesh key={i} geometry={geo.crack} material={mat.crack[i]} />
        ))}
      </group>
      <group ref={web}>
        {mat.web.map((m, i) => (
          <mesh key={i} geometry={geo.web} material={m} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
        ))}
      </group>
      <group ref={magma}>
        {seeds.crack.map((_, i) => (
          <mesh key={i} geometry={geo.magma} material={mat.magma[i]} />
        ))}
      </group>

      <mesh ref={glow} geometry={geo.glow} material={mat.gold} position={[0, 0.2, 0]} />
      <mesh ref={ring} geometry={geo.ring} material={mat.gold} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} />
      <mesh ref={ringPurp} geometry={geo.ring} material={mat.purp} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]} />
      <mesh ref={wave} geometry={geo.wave} material={mat.wave} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0.5]} />
      <mesh ref={waveInner} geometry={geo.wave} material={mat.purp} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.075, 0.5]} />
      <mesh ref={trail} geometry={geo.trail} material={mat.ember} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0.45]} />

      <group ref={avatar} visible={false} position={[0, 0, -1.55]}>
        <Person ghost poseRef={poseRef} rig={LOCO_RIG} idle={false} />
        <group ref={arcs}>
          {mat.arc.map((m, i) => (
            <mesh key={i} geometry={geo.bolt} material={m} />
          ))}
        </group>
      </group>

      <group ref={rise}>
        {mat.rise.map((m, i) => (
          <mesh key={i} geometry={geo.spark} material={m} />
        ))}
      </group>
      <group ref={burst}>
        {mat.burst.map((m, i) => (
          <mesh key={i} geometry={geo.shard} material={m} />
        ))}
      </group>
      <group ref={lava}>
        {mat.lavaBits.map((m, i) => (
          <mesh key={i} geometry={geo.spark} material={m} />
        ))}
      </group>
      <group ref={rock}>
        {mat.rocks.map((m, i) => (
          <mesh key={i} geometry={geo.shard} material={m} />
        ))}
      </group>
      <group ref={bodyArcs}>
        {mat.body.map((m, i) => (
          <mesh key={i} geometry={geo.bolt} material={m} />
        ))}
      </group>

      <pointLight ref={light} color="#ffd056" intensity={0} distance={24} decay={2} />
      <pointLight ref={lightArc} color="#7a5cff" intensity={0} distance={16} decay={2} />
    </group>
  );
}
