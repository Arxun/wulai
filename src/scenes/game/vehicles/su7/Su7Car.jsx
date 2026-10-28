import { useGLTF, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SU7_CAR } from '../../../../config/assets';
import DriverBust from '../../../lowpoly/person/DriverBust';
import { SU7_DRIVER_LOCAL, SU7_MESH_YAW } from './driverSeat';
import { guardFrame } from '../../debug/reportError';
import { terrainHeight } from '../../maps/huangshan/heightfield';
import { vehicle } from '../runtime';

function Su7Car({ bodyColor = '#26d6e9' }) {
  const gltf = useGLTF(SU7_CAR.gltf, false);
  const aoMap = useTexture(SU7_CAR.bodyAo);
  const carRoot = useRef();
  const bustWrap = useRef();
  const wheelParts = useRef([]);
  const lastPose = useRef({ x: NaN, z: NaN, yaw: NaN, sink: NaN, scale: NaN });

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
      obj.frustumCulled = true;
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

  useFrame(guardFrame('vehicles/Su7Car', (_, dt) => {
    if (vehicle == null) {
      throw new Error('vehicle runtime 未就绪');
    }
    const root = carRoot.current;
    if (root) {
      const { carX, carZ, carYaw, sink, scale } = vehicle;
      const lp = lastPose.current;
      if (lp.x !== carX || lp.z !== carZ || lp.yaw !== carYaw || lp.sink !== sink || lp.scale !== scale) {
        root.position.set(carX, terrainHeight(carX, carZ) - sink, carZ);
        root.rotation.set(0, carYaw, 0);
        root.scale.setScalar(scale);
        lp.x = carX;
        lp.z = carZ;
        lp.yaw = carYaw;
        lp.sink = sink;
        lp.scale = scale;
      }
    }
    if (bustWrap.current) bustWrap.current.visible = vehicle.inCar;

    const spin = vehicle.inCar ? vehicle.driveSpeed : 0;
    if (spin > 0.02 && wheelParts.current.length) {
      const step = -spin * 0.032 * Math.min(dt, 0.05);
      for (const w of wheelParts.current) w.rotateZ(step);
    }
  }));

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

export default memo(Su7Car);

useGLTF.preload(SU7_CAR.gltf, false);
