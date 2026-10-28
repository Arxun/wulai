import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { moveOf, moveProgress } from '../../../../lib/animation/combatMoves';
import { combat, world } from '../../stores/combatStore';

/**
 * 连招刀光。每种招一个形状，挂在玩家身上跟着转。
 * 刺=前刺光柱，劈=竖月牙，砍=横月牙，旋=腰间环，下砸=落地震波。
 */

function addMat(color) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export default function AttackFx() {
  const root = useRef();
  const stab = useRef();
  const cleave = useRef();
  const slash = useRef();
  const spin = useRef();
  const plunge = useRef();
  const shock = useRef();
  const light = useRef();

  const geo = useMemo(
    () => ({
      beam: new THREE.CylinderGeometry(0.03, 0.09, 2.45, 7, 1, true),
      tip: new THREE.ConeGeometry(0.11, 0.42, 7, 1, true),
      vert: new THREE.RingGeometry(0.4, 2.45, 18, 1, -0.2, 2.0),
      horiz: new THREE.RingGeometry(0.35, 2.55, 20, 1, -0.35, 2.4),
      ring: new THREE.TorusGeometry(2.45, 0.05, 6, 28),
      pillar: new THREE.CylinderGeometry(0.06, 0.28, 2.8, 8, 1, true),
      shock: new THREE.RingGeometry(0.25, 0.5, 28),
    }),
    [],
  );
  const mat = useMemo(
    () => ({
      stab: addMat('#dcefff'),
      cleave: addMat('#ffe6b0'),
      slash: addMat('#ffd27a'),
      spin: addMat('#ffb84a'),
      plunge: addMat('#ff9a3c'),
      shock: addMat('#fff0c0'),
    }),
    [],
  );
  const matTint = useMemo(
    () => ({
      stab: '#dcefff',
      cleave: '#ffe6b0',
      slash: '#ffd27a',
      spin: '#ffb84a',
      plunge: '#ff9a3c',
      shock: '#fff0c0',
    }),
    [],
  );

  useFrame(() => {
    const busy = world.swing > 0 && world.move && world.move !== 'skill' && world.move !== 'wulai' && world.move !== 'whirl';
    if (root.current) root.current.visible = busy;
    if (!busy) {
      if (light.current) light.current.intensity = 0;
      return;
    }

    const mv = moveOf(world.move);
    const t = moveProgress(world);
    const [a, b] = mv.strike;
    const hit = t >= a && t <= b ? Math.sin(((t - a) / (b - a)) * Math.PI) : 0;
    const wind = t < a ? t / Math.max(0.001, a) : 0;
    const blood = combat.weapon === 'blood';
    const recover = t > b ? Math.max(0, 1 - (t - b) / Math.max(0.001, 1 - b)) : 0;
    const flash = blood ? 0.42 + 0.5 * hit + 0.22 * wind + 0.28 * recover : 0;
    const tint = blood ? '#ff2448' : null;

    const show = (ref, on, opacity) => {
      if (!ref.current) return;
      ref.current.visible = on;
      ref.current.traverse((c) => {
        if (!c.material || c.material.opacity === undefined) return;
        c.material.opacity = on ? opacity : 0;
      });
    };

    show(stab, world.move === 'stab', blood ? flash : 0.15 * wind + 0.85 * hit);
    if (stab.current && world.move === 'stab') {
      stab.current.position.set(-0.22, 1.05, 0.4 + hit * 0.55);
      stab.current.scale.set(1, 0.45 + hit * 1.15, 1);
    }

    show(cleave, world.move === 'cleave', blood ? flash : 0.12 * wind + 0.8 * hit);
    if (cleave.current && world.move === 'cleave') {
      cleave.current.rotation.x = -1.05 + t * 2.3;
      cleave.current.position.set(-0.1, 1.15, 0.4);
    }

    show(slash, world.move === 'slash', blood ? flash : 0.12 * wind + 0.82 * hit);
    if (slash.current && world.move === 'slash') {
      slash.current.rotation.y = -0.9 + t * 2.1;
      slash.current.position.set(0, 1.05, 0.35);
    }

    show(spin, world.move === 'spin', blood ? flash : 0.2 + 0.65 * hit);
    if (spin.current && world.move === 'spin') {
      spin.current.rotation.z = t * Math.PI * 2;
      spin.current.scale.setScalar(0.96 + hit * 0.1);
    }

    show(plunge, world.move === 'plunge', blood ? flash : 0.2 * wind + 0.75 * hit);
    if (plunge.current && world.move === 'plunge') {
      plunge.current.position.set(0, 1.4 - hit * 0.7, 0.2);
      plunge.current.scale.set(1, 0.6 + hit * 1.1, 1);
    }

    show(shock, world.move === 'plunge' && (blood || hit > 0.15), blood ? flash * 0.7 : Math.max(0, 0.7 - hit * 0.7));
    if (shock.current && world.move === 'plunge') {
      const k = 0.5 + hit * 3.2;
      shock.current.scale.set(k, k, 1);
    }

    Object.keys(mat).forEach((k) => mat[k].color.set(tint || matTint[k]));
    if (light.current) {
      light.current.color.set(blood ? '#ff2040' : mv.color);
      light.current.intensity = blood ? 4.5 + hit * 8 + wind * 2 + recover * 3 : 2 + hit * 10 + wind * 3;
      light.current.position.set(-0.15, 1.1, 0.4 + hit * 0.6);
    }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={stab} visible={false}>
        <mesh geometry={geo.beam} material={mat.stab} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geo.tip} material={mat.stab} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.25]} />
      </group>
      <mesh ref={cleave} geometry={geo.vert} material={mat.cleave} visible={false} />
      <mesh ref={slash} geometry={geo.horiz} material={mat.slash} rotation={[Math.PI / 2, 0, 0]} visible={false} />
      <mesh ref={spin} geometry={geo.ring} material={mat.spin} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.95, 0]} visible={false} />
      <mesh ref={plunge} geometry={geo.pillar} material={mat.plunge} visible={false} />
      <mesh ref={shock} geometry={geo.shock} material={mat.shock} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0.2]} visible={false} />
      <pointLight ref={light} color="#fff4d2" intensity={0} distance={6} decay={2} />
    </group>
  );
}
