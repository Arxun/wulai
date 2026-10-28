import { useMemo, useRef } from 'react';
import { useSkillFxWarmupRoot } from '../../debug/useSkillFxWarmupRoot';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HEAVY_RANGE, HEAVY_TIME, world } from '../../stores/combatStore';

/**
 * K 重击的技能特效。挂在玩家身上：
 *   蓄力 —— 金光往武器上收、碎晶绕身、地面符环收缩；
 *   砸地 —— 月牙刀光扫过、冲击波铺开、火花往前炸。
 */

const ORBS = 10;
const SPARKS = 18;
const { clamp } = THREE.MathUtils;

function addMat(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export default function HeavySkillFx() {
  const root = useRef();
  useSkillFxWarmupRoot(root);
  const glow = useRef();
  const blade = useRef();
  const pillar = useRef();
  const gather = useRef();
  const shock = useRef();
  const light = useRef();
  const orbs = useRef();
  const sparks = useRef();

  const geo = useMemo(
    () => ({
      sphere: new THREE.SphereGeometry(0.22, 8, 6),
      shard: new THREE.TetrahedronGeometry(0.07),
      spark: new THREE.TetrahedronGeometry(0.05),
      slash: new THREE.RingGeometry(0.55, 2.15, 22, 1, -0.15, 2.2),
      ring: new THREE.RingGeometry(0.85, 1.08, 28),
      shock: new THREE.RingGeometry(0.2, 0.42, 32),
      pillar: new THREE.CylinderGeometry(0.08, 0.42, 3.6, 8, 1, true),
    }),
    [],
  );
  const mat = useMemo(
    () => ({
      glow: addMat('#ffe08a', 0.55),
      shard: addMat('#ffd24a', 0.85),
      spark: addMat('#fff4c8', 0.9),
      slash: addMat('#ffe9a0', 0.8),
      ring: addMat('#ffc44a', 0.45),
      shock: addMat('#fff0b8', 0.7),
      pillar: addMat('#ffd56a', 0.55),
    }),
    [],
  );
  const orbSeed = useMemo(() => Array.from({ length: ORBS }, () => Math.random()), []);
  const sparkSeed = useMemo(() => Array.from({ length: SPARKS }, () => Math.random()), []);

  useFrame((state) => {
    const on = world.heavy > 0;
    if (root.current) root.current.visible = on;
    if (!on) {
      if (light.current) light.current.intensity = 0;
      return;
    }

    const t = 1 - world.heavy / HEAVY_TIME;
    const charge = t < 0.42 ? t / 0.42 : Math.max(0, 1 - (t - 0.42) / 0.1);
    const slam = t < 0.42 ? 0 : t < 0.7 ? (t - 0.42) / 0.28 : Math.max(0, 1 - (t - 0.7) / 0.3);
    const clock = state.clock.elapsedTime;
    const pulse = 0.72 + 0.28 * Math.sin(clock * 26);

    if (glow.current) {
      glow.current.visible = charge > 0.04;
      const s = (0.55 + charge * 1.4) * pulse;
      glow.current.position.set(-0.32, 1.35 + charge * 0.35, -0.15);
      glow.current.scale.setScalar(s);
      glow.current.material.opacity = 0.18 + charge * 0.55;
    }

    if (orbs.current) {
      orbs.current.visible = charge > 0.02;
      orbs.current.children.forEach((m, i) => {
        const seed = orbSeed[i];
        const a = clock * (2.4 + seed) + seed * 6 + i;
        const r = 0.55 + 0.35 * (1 - charge) + seed * 0.2;
        const y = 0.35 + ((clock * 0.55 + seed) % 1) * 1.35 * charge;
        m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        m.scale.setScalar((0.45 + seed * 0.7) * charge * pulse);
        m.rotation.x += 0.08;
        m.rotation.y += 0.11;
      });
    }

    if (gather.current) {
      const k = 2.2 - charge * 1.15;
      gather.current.visible = charge > 0.05 && slam < 0.15;
      gather.current.scale.set(k, k, 1);
      gather.current.material.opacity = 0.15 + charge * 0.5 * pulse;
    }

    if (blade.current) {
      blade.current.visible = slam > 0.02;
      blade.current.rotation.x = -1.15 + slam * 2.55;
      blade.current.rotation.y = -0.35 + slam * 0.7;
      blade.current.position.set(-0.05, 1.05, 0.35 + slam * 0.55);
      blade.current.scale.set(1, 1, 0.7 + slam * 0.9);
      blade.current.material.opacity = slam < 0.55 ? slam * 1.5 : Math.max(0, 1.2 - slam * 1.4);
    }

    if (shock.current) {
      shock.current.visible = slam > 0.08;
      const k = 0.6 + slam * HEAVY_RANGE * 1.15;
      shock.current.scale.set(k, k, 1);
      shock.current.material.opacity = clamp(0.85 - slam * 0.95, 0, 0.8);
    }

    if (pillar.current) {
      const p = slam > 0.05 && slam < 0.85 ? Math.sin(slam * Math.PI) : 0;
      pillar.current.visible = p > 0.02;
      pillar.current.scale.set(0.7 + slam * 1.8, 0.55 + p * 1.1, 0.7 + slam * 1.8);
      pillar.current.material.opacity = p * 0.55;
    }

    if (sparks.current) {
      sparks.current.visible = slam > 0.05;
      sparks.current.children.forEach((sp, i) => {
        const seed = sparkSeed[i];
        const life = clamp((slam - 0.02) / 0.7, 0, 1);
        const ang = seed * Math.PI * 1.6 - 0.3;
        const dist = 0.4 + life * (2.2 + seed * 1.6);
        sp.position.set(Math.sin(ang) * dist * 0.55, 0.25 + (1 - seed) * 0.7 * (1 - life), Math.cos(ang) * dist);
        sp.scale.setScalar((1 - life) * (0.5 + seed) * (slam > 0 ? 1 : 0));
        sp.rotation.x += 0.2;
      });
    }

    if (light.current) {
      light.current.position.set(-0.2, 1.15, 0.2 + slam * 1.1);
      light.current.intensity = 4 + charge * 10 * pulse + slam * 22;
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={glow} geometry={geo.sphere} material={mat.glow} />
      <group ref={orbs}>
        {orbSeed.map((_, i) => (
          <mesh key={i} geometry={geo.shard} material={mat.shard} />
        ))}
      </group>
      <mesh ref={blade} geometry={geo.slash} material={mat.slash} rotation={[0, 0, 0.4]} />
      <mesh ref={pillar} geometry={geo.pillar} material={mat.pillar} position={[0, 1.7, 0.35]} />
      <mesh ref={gather} geometry={geo.ring} material={mat.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} />
      <mesh ref={shock} geometry={geo.shock} material={mat.shock} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0.4]} />
      <group ref={sparks}>
        {sparkSeed.map((_, i) => (
          <mesh key={i} geometry={geo.spark} material={mat.spark} />
        ))}
      </group>
      <pointLight ref={light} color="#ffd056" intensity={0} distance={9} decay={2} />
    </group>
  );
}
