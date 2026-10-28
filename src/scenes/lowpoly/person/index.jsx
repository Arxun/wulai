import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import Arms from './Arms';
import Gear from './Gear';
import Head from './Head';
import Legs from './Legs';
import Torso from './Torso';
import { IDLE_RIG } from './rigs';
import { vehicle } from '../../game/vehicleStore';

const PELVIS = [0, 0.72, 0];
const NECK = [0, 1.44, 0];

export default function Person({ idle = true, poseRef, rig = IDLE_RIG, ghost = false }) {
  const root = useRef();
  const upper = useRef();
  const head = useRef();

  useFrame(({ clock }) => {
    if (vehicle.inCar) {
      if (root.current) root.current.visible = false;
      return;
    }
    if (root.current) root.current.visible = true;

    if (ghost && root.current && !root.current.userData.ghosted) {
      root.current.userData.ghosted = true;
      root.current.traverse((o) => {
        if (o.isLight) {
          o.visible = false;
          return;
        }
        if (!o.isMesh || !o.material) return;
        o.castShadow = false;
        o.receiveShadow = false;
        o.material = new THREE.MeshBasicMaterial({
          color: '#ffb24a',
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      });
    }

    const pose = poseRef?.current;
    if (pose) {
      if (root.current) root.current.position.y = pose.bodyY;
      if (upper.current) upper.current.rotation.set(pose.lean, pose.twist, pose.roll);
      if (head.current) head.current.rotation.set(pose.headPitch, pose.headYaw, 0);
      return;
    }
    if (!idle || !root.current) return;
    const t = clock.getElapsedTime();
    root.current.rotation.y = Math.sin(t * 0.55) * 0.02;
    root.current.position.y = Math.sin(t * 1.4) * 0.0015;
  });

  return (
    <group ref={root}>
      <Legs rig={rig.legs} poseRef={poseRef} />
      <group position={PELVIS}>
        <group ref={upper}>
          <group position={[-PELVIS[0], -PELVIS[1], -PELVIS[2]]}>
            <Torso />
            <Arms rig={rig.arms} poseRef={poseRef} />
            <Gear />
            <group position={NECK} ref={head}>
              <group position={[-NECK[0], -NECK[1], -NECK[2]]}>
                <Head />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
