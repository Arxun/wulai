import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import Arms from './Arms';
import Head from './Head';
import Torso from './Torso';
import { DRIVER_RIG } from './rigs';

/** 与 Person 一致的上半身层级（从骨盆起） */
const PELVIS = [0, 0.72, 0];
const NECK = [0, 1.44, 0];

/**
 * 主驾：头 + 躯干 + 双手（无腿、无背包、无武器）。
 */
export default function DriverBust({ poseRef }) {
  const upper = useRef();
  const head = useRef();

  useFrame(() => {
    const pose = poseRef?.current;
    if (!pose) return;
    if (upper.current) upper.current.rotation.set(pose.lean, pose.twist, pose.roll);
    if (head.current) head.current.rotation.set(pose.headPitch, pose.headYaw, 0);
  });

  return (
    <group>
      <group ref={upper}>
        <group position={[-PELVIS[0], -PELVIS[1], -PELVIS[2]]}>
          <Torso />
          <Arms rig={DRIVER_RIG.arms} poseRef={poseRef} />
          <group position={NECK} ref={head}>
            <group position={[-NECK[0], -NECK[1], -NECK[2]]}>
              <Head />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
