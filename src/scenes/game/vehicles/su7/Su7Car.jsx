import { useGLTF, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SU7_CAR } from '../../../../config/assets';
import DriverBust from '../../../lowpoly/person/DriverBust';
import { SU7_DRIVER_LOCAL, SU7_MESH_YAW } from './driverSeat';
import { terrainHeight } from '../../maps/huangshan/heightfield';
import { vehicle } from '../runtime';

export default function Su7Car({ bodyColor = '#26d6e9' }) {
  const gltf = useGLTF(SU7_CAR.gltf, false);
  const aoMap = useTexture(SU7_CAR.bodyAo);
  const carRoot = useRef();
  const bustWrap = useRef();
  const wheelParts = useRef([]);

  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);

  useLayoutEffect(() => {
    aoMap.flipY = false;
    aoMap.colorSpace = THREE.LinearSRGBColorSpace;
    aoMap.minFilter = THREE.NearestFilter;
    aoMap.magFilter = THREE.NearestFilter;
    aoMap.channel = 1;
    aoMap.needsUpdate = true;
  }, [aoMap]);

  useLayoutEffect(() => {
    const body = scene.getObjectByName('body');
    if (body?.isMesh) {
      const mat = body.material;
      if (mat?.isMeshStandardMaterial) mat.color.set(bodyColor);
    }
    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mat = obj.material;
      if (mat?.isMeshStandardMaterial) {
        mat.aoMap = aoMap;
        mat.needsUpdate = true;
      }
    });
  }, [scene, aoMap, bodyColor]);

  useLayoutEffect(() => {
    const parts = [];
    scene.traverse((obj) => {
      if (/^Wheel\.\d+$/.test(obj.name)) parts.push(obj);
    });
    wheelParts.current = parts;
  }, [scene]);

  useLayoutEffect(() => {
    const wrap = bustWrap.current;
    if (!wrap) return;
    const { x: lx, y: ly, z: lz, rotY } = SU7_DRIVER_LOCAL;
    wrap.position.set(lx, ly, lz);
    wrap.rotation.set(0, rotY, 0);
  }, [scene]);

  useFrame((_, dt) => {
    const root = carRoot.current;
    if (root) {
      const { carX, carZ, carYaw, sink, scale } = vehicle;
      root.position.set(carX, terrainHeight(carX, carZ) - sink, carZ);
      root.rotation.set(0, carYaw, 0);
      root.scale.setScalar(scale);
    }
    if (bustWrap.current) bustWrap.current.visible = vehicle.inCar;

    const spin = vehicle.inCar ? vehicle.driveSpeed : 0;
    if (spin > 0.02 && wheelParts.current.length) {
      const step = -spin * 0.032 * Math.min(dt, 0.05);
      for (const w of wheelParts.current) w.rotateZ(step);
    }
  });

  return (
    <group ref={carRoot}>
      <group rotation={[0, SU7_MESH_YAW, 0]}>
        <primitive object={scene} />
        <group ref={bustWrap} visible={false}>
          <DriverBust poseRef={vehicle.poseRef} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(SU7_CAR.gltf, false);
