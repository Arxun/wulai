import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { moveProgress } from '../../lib/animation/combatMoves';
import { world } from './combatStore';

/**
 * E 回旋斩：全部水平绕 Y 转，像盖伦 E 的腰斩光环。
 * 不倾斜、不上下甩。挂在玩家身上。
 */

const SPARKS = 16;
const { clamp } = THREE.MathUtils;
const FLAT = [-Math.PI / 2, 0, 0];

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

export default function WhirlFx() {
  const root = useRef();
  const ring = useRef();
  const ring2 = useRef();
  const disc = useRef();
  const ground = useRef();
  const slashA = useRef();
  const slashB = useRef();
  const slashC = useRef();
  const trail = useRef();
  const sparks = useRef();
  const light = useRef();

  const geo = useMemo(
    () => ({
      ring: new THREE.RingGeometry(1.18, 1.42, 40),
      ringThin: new THREE.RingGeometry(1.55, 1.72, 40),
      disc: new THREE.RingGeometry(0.5, 1.65, 40),
      ground: new THREE.RingGeometry(0.45, 1.5, 36),
      slash: new THREE.RingGeometry(0.7, 2.15, 28, 1, 0, 1.35),
      trail: new THREE.RingGeometry(0.95, 2.35, 20, 1, 0, 0.72),
      spark: new THREE.PlaneGeometry(0.32, 0.05),
    }),
    [],
  );
  const mat = useMemo(
    () => ({
      gold: addMat('#ffe8a0'),
      white: addMat('#fff6d2'),
      steel: addMat('#c8dcff'),
      ember: addMat('#ffc46a'),
      sparks: Array.from({ length: SPARKS }, (_, i) => addMat(i % 3 === 0 ? '#c8dcff' : '#ffe08a', 0.8)),
    }),
    [],
  );
  const seeds = useMemo(() => Array.from({ length: SPARKS }, () => Math.random()), []);

  useFrame(() => {
    const on = world.move === 'whirl' && world.swing > 0;
    if (root.current) root.current.visible = on;
    if (!on) {
      if (light.current) light.current.intensity = 0;
      return;
    }

    const t = moveProgress(world);
    const sec = t * 3;
    const fade = t < 0.06 ? t / 0.06 : t > 0.9 ? clamp((1 - t) / 0.1, 0, 1) : 1;
    const spin = (sec / 0.3) * Math.PI * 2;
    const rev = (sec / 0.3) % 1;
    const beat = Math.pow(Math.max(0, 1 - rev / 0.2), 1.6);

    if (ring.current) {
      ring.current.rotation.z = -spin;
      ring.current.material.opacity = (0.42 + beat * 0.35) * fade;
    }
    if (ring2.current) {
      ring2.current.rotation.z = spin * 0.65;
      ring2.current.material.opacity = 0.32 * fade;
    }
    if (disc.current) {
      disc.current.rotation.z = -spin;
      disc.current.material.opacity = (0.12 + beat * 0.16) * fade;
    }
    if (ground.current) {
      ground.current.rotation.z = spin * 0.3;
      ground.current.material.opacity = (0.2 + beat * 0.18) * fade;
    }

    if (slashA.current) {
      slashA.current.rotation.z = -spin;
      slashA.current.material.opacity = (0.55 + beat * 0.4) * fade;
    }
    if (slashB.current) {
      slashB.current.rotation.z = -spin + 2.094;
      slashB.current.material.opacity = (0.4 + beat * 0.25) * fade;
    }
    if (slashC.current) {
      slashC.current.rotation.z = -spin + 4.189;
      slashC.current.material.opacity = 0.38 * fade;
    }
    if (trail.current) {
      trail.current.rotation.z = -spin - 0.15;
      const s = 1 + beat * 0.18;
      trail.current.scale.set(s, s, 1);
      trail.current.material.opacity = (0.75 + beat * 0.25) * fade;
    }

    if (sparks.current) {
      sparks.current.children.forEach((m, i) => {
        const seed = seeds[i];
        const a = spin + seed * Math.PI * 2;
        const r = 0.95 + (i % 4) * 0.18;
        const y = 0.88 + (i % 3) * 0.06;
        m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        m.rotation.set(-Math.PI / 2, 0, -a);
        m.scale.setScalar(0.7 + seed * 0.4);
        if (m.material) m.material.opacity = 0.5 * fade;
      });
    }

    if (light.current) {
      light.current.intensity = (5 + beat * 10) * fade;
      light.current.position.set(0, 0.95, 0);
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={ground} geometry={geo.ground} material={mat.ember} rotation={FLAT} position={[0, 0.04, 0]} />
      <mesh ref={disc} geometry={geo.disc} material={mat.gold} rotation={FLAT} position={[0, 0.92, 0]} />
      <mesh ref={ring} geometry={geo.ring} material={mat.white} rotation={FLAT} position={[0, 0.94, 0]} />
      <mesh ref={ring2} geometry={geo.ringThin} material={mat.steel} rotation={FLAT} position={[0, 0.96, 0]} />
      <mesh ref={slashA} geometry={geo.slash} material={mat.gold} rotation={FLAT} position={[0, 0.93, 0]} />
      <mesh ref={slashB} geometry={geo.slash} material={mat.white} rotation={FLAT} position={[0, 0.93, 0]} />
      <mesh ref={slashC} geometry={geo.slash} material={mat.steel} rotation={FLAT} position={[0, 0.93, 0]} />
      <mesh ref={trail} geometry={geo.trail} material={mat.white} rotation={FLAT} position={[0, 0.94, 0]} />
      <group ref={sparks}>
        {mat.sparks.map((m, i) => (
          <mesh key={i} geometry={geo.spark} material={m} />
        ))}
      </group>
      <pointLight ref={light} color="#ffe8a0" intensity={0} distance={8} decay={2} />
    </group>
  );
}
