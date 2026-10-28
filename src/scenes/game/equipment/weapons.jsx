import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import FacetMesh from '../../../lib/components/FacetMesh';
import { makeBlobGeometry } from '../../../lib/geometry/organic';
import { makeLoftGeometry } from '../../../lib/geometry/loft';
import { fabricTextures } from '../../../lib/textures/procedural';
import { C } from '../../lowpoly/person/palette';
import { WEAPON_ORDER, combat, world } from '../stores/combatStore';

/**
 * 武器网格。槽约定：原点 = 右手握点，+Y = 刃 / 杖尖。
 * 换武器只在 VIEW 里加模型，手臂和插槽不用动。
 */

function shaft(keys, color, seed, extra = {}) {
  return makeLoftGeometry({
    keys,
    samples: extra.samples ?? 6,
    segments: extra.segments ?? 6,
    color,
    capColor: extra.capColor,
    jitter: extra.jitter ?? 0.02,
    faceTint: extra.faceTint ?? 0.04,
    seed,
  });
}

function Stick() {
  const tex = useMemo(() => fabricTextures('grain'), []);
  const g = useMemo(
    () => ({
      pole: shaft(
        [
          { p: [0, 0.02, 0], a: 0.018 },
          { p: [0, 0.4, 0], a: 0.017 },
          { p: [0, 0.82, 0], a: 0.015 },
        ],
        C.stick,
        201,
        { capColor: '#b99a68', jitter: 0.03, faceTint: 0.05 },
      ),
      knob: makeBlobGeometry({ radius: 0.024, detail: 0, scale: [1, 1.15, 1], jitter: 0.05, color: '#cbb685', seed: 202 }),
    }),
    [],
  );
  return (
    <group>
      <FacetMesh geometry={g.pole} roughness={0.7} texture={tex} bumpScale={1} />
      <FacetMesh geometry={g.knob} position={[0, -0.02, 0]} roughness={0.7} />
    </group>
  );
}

function IronHalberd() {
  const g = useMemo(
    () => ({
      pole: shaft(
        [
          { p: [0, 0.02, 0], a: 0.017 },
          { p: [0, 0.42, 0], a: 0.018 },
          { p: [0, 0.78, 0], a: 0.016 },
        ],
        '#4a4e56',
        311,
        { capColor: '#2d3036' },
      ),
      blade: shaft(
        [
          { p: [0, 0.74, 0], a: 0.012, b: 0.04 },
          { p: [0, 0.96, 0], a: 0.008, b: 0.07 },
          { p: [0, 1.1, 0], a: 0.003, b: 0.02 },
        ],
        '#c5cdd6',
        312,
        { capColor: '#e8eef4', jitter: 0.01, samples: 8 },
      ),
    }),
    [],
  );
  return (
    <group>
      <FacetMesh geometry={g.pole} roughness={0.45} metalness={0.35} />
      <FacetMesh geometry={g.blade} roughness={0.25} metalness={0.7} />
      <mesh position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.026, 6, 5]} />
        <meshStandardMaterial color="#8a6a32" roughness={0.4} metalness={0.5} flatShading />
      </mesh>
    </group>
  );
}

function FrostStaff() {
  const g = useMemo(
    () => ({
      pole: shaft(
        [
          { p: [0, 0.02, 0], a: 0.015 },
          { p: [0, 0.38, 0], a: 0.016 },
          { p: [0, 0.72, 0], a: 0.015 },
        ],
        '#6f8ea8',
        321,
        { capColor: '#9ec4d8', jitter: 0.015, segments: 7 },
      ),
      crystal: makeBlobGeometry({
        radius: 0.055,
        detail: 1,
        scale: [0.7, 1.35, 0.7],
        jitter: 0.12,
        color: '#b7e7ff',
        seed: 322,
      }),
    }),
    [],
  );
  return (
    <group>
      <FacetMesh geometry={g.pole} roughness={0.35} metalness={0.25} />
      <FacetMesh geometry={g.crystal} position={[0, 0.8, 0]} roughness={0.15} metalness={0.4} />
      <pointLight position={[0, 0.82, 0]} color="#9ad8ff" intensity={1.6} distance={2.4} />
    </group>
  );
}

function EmberSpear() {
  const g = useMemo(
    () => ({
      pole: shaft(
        [
          { p: [0, 0.02, 0], a: 0.016 },
          { p: [0, 0.4, 0], a: 0.017 },
          { p: [0, 0.82, 0], a: 0.014 },
        ],
        '#3a2218',
        331,
        { capColor: '#1a100c' },
      ),
      head: shaft(
        [
          { p: [0, 0.78, 0], a: 0.03, b: 0.02 },
          { p: [0, 0.98, 0], a: 0.018, b: 0.014 },
          { p: [0, 1.14, 0], a: 0.003, b: 0.003 },
        ],
        '#ff6a22',
        332,
        { capColor: '#ffd27a', samples: 7 },
      ),
    }),
    [],
  );
  return (
    <group>
      <FacetMesh geometry={g.pole} roughness={0.7} />
      <FacetMesh geometry={g.head} roughness={0.25} metalness={0.2} />
      <pointLight position={[0, 1.0, 0]} color="#ff7a2a" intensity={2.4} distance={3.2} />
    </group>
  );
}

const SPIKES = [
  { y: 0.32, x: 0.046, s: 0.055, tilt: 0.35 },
  { y: 0.4, x: -0.05, s: 0.07, tilt: -0.42 },
  { y: 0.5, x: 0.054, s: 0.08, tilt: 0.28 },
  { y: 0.58, x: -0.048, s: 0.05, tilt: -0.5 },
  { y: 0.68, x: 0.042, s: 0.062, tilt: 0.4 },
  { y: 0.76, x: -0.038, s: 0.048, tilt: -0.32 },
  { y: 0.86, x: 0.03, s: 0.042, tilt: 0.22 },
  { y: 0.94, x: -0.022, s: 0.034, tilt: -0.18 },
];

const ORBS = 18;
const MIST = 16;

function BloodSword() {
  const tex = useMemo(() => fabricTextures('obsidian'), []);
  const orbs = useRef();
  const mist = useRef();
  const veins = useRef();
  const aura = useRef();
  const glowA = useRef();
  const glowB = useRef();
  const g = useMemo(
    () => ({
      hilt: shaft(
        [
          { p: [0, -0.04, 0], a: 0.022 },
          { p: [0, 0.04, 0], a: 0.02 },
          { p: [0, 0.14, 0], a: 0.018 },
        ],
        '#7a1020',
        351,
        { capColor: '#4a0812', jitter: 0.018, segments: 8 },
      ),
      guard: shaft(
        [
          { p: [0, 0.155, 0], a: 0.016, b: 0.014 },
          { p: [0, 0.175, 0], a: 0.055, b: 0.018 },
          { p: [0, 0.2, 0], a: 0.012, b: 0.012 },
        ],
        '#9a1428',
        352,
        { capColor: '#5a0a16', jitter: 0.04, samples: 9, segments: 8 },
      ),
      blade: makeLoftGeometry({
        keys: [
          { p: [0, 0.2, 0], a: 0.016, b: 0.01 },
          { p: [0, 0.46, 0], a: 0.042, b: 0.011 },
          { p: [0, 0.78, 0], a: 0.046, b: 0.009 },
          { p: [0, 1.04, 0], a: 0.014, b: 0.003 },
        ],
        samples: 10,
        segments: 14,
        color: (t, theta) => {
          const edge = Math.pow(Math.abs(Math.cos(theta)), 2);
          return edge > 0.55 ? '#ff2040' : '#c41428';
        },
        jitter: 0.018,
        faceTint: 0.06,
        profile: (t, theta) => {
          const edge = Math.pow(Math.abs(Math.cos(theta)), 3);
          const teeth = Math.sin(t * Math.PI * 16 + Math.sign(Math.cos(theta)) * 0.7);
          return 1 + edge * Math.max(0, teeth) * 0.28;
        },
        uvMeters: 0.08,
        seed: 353,
      }),
      vein: makeLoftGeometry({
        keys: [
          { p: [0, 0.22, 0.006], a: 0.004, b: 0.003 },
          { p: [0.006, 0.5, 0.008], a: 0.0035, b: 0.0025 },
          { p: [-0.004, 0.78, 0.006], a: 0.003, b: 0.002 },
          { p: [0, 1.0, 0.003], a: 0.0015, b: 0.001 },
        ],
        samples: 8,
        segments: 8,
        color: '#ff2040',
        jitter: 0.01,
        faceTint: 0.02,
        seed: 354,
      }),
      pommel: makeBlobGeometry({
        radius: 0.028,
        detail: 1,
        scale: [1.05, 0.85, 1.05],
        jitter: 0.08,
        color: '#8a1020',
        seed: 355,
      }),
      aura: makeLoftGeometry({
        keys: [
          { p: [0, 0.2, 0], a: 0.022, b: 0.016 },
          { p: [0, 0.5, 0], a: 0.052, b: 0.018 },
          { p: [0, 0.82, 0], a: 0.056, b: 0.016 },
          { p: [0, 1.08, 0], a: 0.02, b: 0.008 },
        ],
        samples: 8,
        segments: 10,
        color: '#ff2040',
        jitter: 0.01,
        seed: 356,
      }),
    }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const swinging = world.swing > 0 || world.heavy > 0 || world.lock;
    const flare = swinging ? 1.55 : 1;
    if (orbs.current) {
      orbs.current.children.forEach((m, i) => {
        const a = t * 0.7 + i * 0.38;
        const y = 0.26 + ((t * 0.18 + i * 0.11) % 1) * 0.78;
        const rad = 0.055 + 0.028 * Math.sin(t * 1.4 + i);
        m.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
        const s = 0.45 + 0.35 * Math.sin(t * 3.2 + i);
        m.scale.setScalar(s);
        if (m.material) m.material.opacity = (0.7 + 0.3 * Math.sin(t * 4 + i)) * flare;
      });
    }
    if (mist.current) {
      mist.current.children.forEach((m, i) => {
        const u = (t * 0.22 + i / MIST) % 1;
        const y = 0.22 + u * 0.82;
        const wob = Math.sin(t * 2.2 + i) * 0.018;
        m.position.set(wob, y, 0.012 + Math.sin(t + i) * 0.01);
        m.scale.set(0.7 + u * 0.6, 1.2 - u * 0.4, 0.7);
        if (m.material) m.material.opacity = (1 - u) * (swinging ? 0.55 : 0.35);
      });
    }
    if (veins.current) {
      const pulse = 0.75 + 0.35 * Math.sin(t * 5.2);
      veins.current.traverse((o) => {
        if (o.material?.emissiveIntensity !== undefined) o.material.emissiveIntensity = (1.2 + pulse * 1.6) * flare;
      });
    }
    if (aura.current?.material) {
      aura.current.material.opacity = (swinging ? 0.55 : 0.28) * (0.8 + 0.2 * Math.sin(t * 6));
    }
    if (glowA.current) glowA.current.intensity = (swinging ? 4.6 : 2.4);
    if (glowB.current) glowB.current.intensity = (swinging ? 2.2 : 1.1);
  });

  return (
    <group>
      <mesh geometry={g.hilt} castShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.5}
          metalness={0.45}
          map={tex.map}
          bumpMap={tex.bump}
          bumpScale={1.2}
          emissive="#8a1020"
          emissiveIntensity={0.55}
        />
      </mesh>
      <mesh geometry={g.guard} castShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.42}
          metalness={0.55}
          map={tex.map}
          bumpMap={tex.bump}
          bumpScale={1.1}
          emissive="#c41428"
          emissiveIntensity={0.7}
        />
      </mesh>
      <mesh geometry={g.pommel} position={[0, -0.05, 0]} castShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.4}
          metalness={0.5}
          emissive="#8a1020"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh geometry={g.blade} castShadow>
        <meshStandardMaterial
          vertexColors
          color="#ffffff"
          roughness={0.38}
          metalness={0.55}
          map={tex.map}
          roughnessMap={tex.bump}
          bumpMap={tex.bump}
          bumpScale={1.15}
          emissive="#ff1230"
          emissiveIntensity={0.85}
        />
      </mesh>
      <mesh ref={aura} geometry={g.aura}>
        <meshBasicMaterial
          color="#ff2048"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <group ref={veins}>
        <mesh geometry={g.vein}>
          <meshPhysicalMaterial
            color="#ff2448"
            emissive="#ff1238"
            emissiveIntensity={1.6}
            roughness={0.18}
            metalness={0.1}
            transmission={0.28}
            thickness={0.12}
            transparent
            opacity={0.88}
            attenuationColor="#8a0018"
            attenuationDistance={0.08}
          />
        </mesh>
      </group>
      {SPIKES.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, 0]} rotation={[0, 0, s.x > 0 ? Math.PI / 2 - s.tilt : -Math.PI / 2 - s.tilt]} castShadow>
          <coneGeometry args={[0.007, s.s, 5]} />
          <meshStandardMaterial
            color="#ff2040"
            emissive="#ff1230"
            emissiveIntensity={2.2}
            roughness={0.22}
            metalness={0.35}
          />
        </mesh>
      ))}
      <group ref={orbs}>
        {Array.from({ length: ORBS }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.01, 6, 5]} />
            <meshBasicMaterial color={i % 2 ? '#ff2040' : '#ff6a4a'} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group ref={mist}>
        {Array.from({ length: MIST }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.018, 6, 5]} />
            <meshBasicMaterial color="#8a1020" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <pointLight ref={glowA} position={[0, 0.62, 0]} color="#ff2040" intensity={2.4} distance={3.6} />
      <pointLight ref={glowB} position={[0, 0.18, 0]} color="#ff3a50" intensity={1.1} distance={2.2} />
    </group>
  );
}

function StormBlade() {
  const g = useMemo(
    () => ({
      hilt: shaft(
        [
          { p: [0, -0.02, 0], a: 0.018 },
          { p: [0, 0.12, 0], a: 0.016 },
          { p: [0, 0.2, 0], a: 0.02 },
        ],
        '#1c2430',
        341,
        { capColor: '#0e141c', jitter: 0.015 },
      ),
      blade: shaft(
        [
          { p: [0, 0.2, 0], a: 0.01, b: 0.034 },
          { p: [0, 0.58, 0], a: 0.008, b: 0.042 },
          { p: [0, 0.92, 0], a: 0.002, b: 0.01 },
        ],
        '#d2e4ff',
        342,
        { capColor: '#f4fbff', jitter: 0.008, faceTint: 0.02, samples: 8 },
      ),
    }),
    [],
  );
  return (
    <group>
      <FacetMesh geometry={g.hilt} roughness={0.4} metalness={0.45} />
      <FacetMesh geometry={g.blade} roughness={0.12} metalness={0.85} />
      <mesh position={[0, 0.18, 0]} rotation={[0, 0, 0.2]} castShadow>
        <boxGeometry args={[0.09, 0.018, 0.03]} />
        <meshStandardMaterial color="#c9a24a" roughness={0.35} metalness={0.6} flatShading />
      </mesh>
      <pointLight position={[0, 0.62, 0]} color="#9ecbff" intensity={1.8} distance={2.6} />
    </group>
  );
}

const VIEW = {
  wood: Stick,
  iron: IronHalberd,
  frost: FrostStaff,
  ember: EmberSpear,
  storm: StormBlade,
  blood: BloodSword,
};

/** 右手插槽里的当前武器。加新刀：VIEW 加模型，weaponDefs.js 加握点，combatStore 登记属性。 */
export default function HeldWeapon() {
  const bag = useRef({});
  useFrame(() => {
    for (const id of WEAPON_ORDER) {
      const g = bag.current[id];
      if (g) g.visible = combat.weapon === id;
    }
  });
  return (
    <group>
      {WEAPON_ORDER.map((id) => {
        const Comp = VIEW[id] || Stick;
        return (
          <group
            key={id}
            ref={(el) => {
              bag.current[id] = el;
            }}
            visible={id === 'wood'}
          >
            <Comp />
          </group>
        );
      })}
    </group>
  );
}
