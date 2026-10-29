import { useGLTF, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SU7_CAR } from '../../../../config/assets';
import { configureSu7GltfLoader } from '../../su7DracoLoader';
import DriverBust from '../../../lowpoly/person/DriverBust';
import { SU7_DRIVER_LOCAL, SU7_MESH_YAW } from './driverSeat';
import { replicaUpdateWheels } from './replicaCar';
import { bindSu7WheelModel, listSu7WheelSpinNodes } from './wheels';
import NitroFlame from '../../NitroFlame';
import { drift } from '../../stores/driftStore';
import { guardFrame } from '../../debug/reportError';
import { terrainHeight } from '../../maps/huangshan/heightfield';
import { vehicle } from '../runtime';

function Su7Car({ bodyColor = '#26d6e9' }) {
  const gltf = useGLTF(SU7_CAR.gltf, true, false, configureSu7GltfLoader);
  const aoMap = useTexture(SU7_CAR.bodyAo);
  const carRoot = useRef();
  const bustWrap = useRef();
  /** replica `Car.wheelModel` */
  const wheelModel = useRef(null);
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
    const hub = bindSu7WheelModel(scene);
    wheelModel.current = hub;
    vehicle.wheelHub = hub;
    vehicle.wheelSpinners = listSu7WheelSpinNodes(hub);
    vehicle.ready = true;
    return () => {
      vehicle.wheelHub = null;
      vehicle.wheelSpinners = [];
      vehicle.ready = false;
      wheelModel.current = null;
    };
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

    // replica Car.update（Player 已先更新 driveSpeed）
    if (vehicle.inCar && wheelModel.current) {
      replicaUpdateWheels(wheelModel.current, vehicle.driveSpeed, dt);
    }
  }, 1));

  return (
    <group ref={carRoot}>
      <group rotation={[0, SU7_MESH_YAW, 0]}>
        <primitive object={scene} />
        <group ref={bustWrap} visible={false}>
          <DriverBust poseRef={vehicle.poseRef} />
        </group>
      </group>
      {/* 与 carRoot 对齐：+Z 车头，车尾 -Z 喷火（勿挂在 MESH_YAW 子树里，局部轴会拧 90°） */}
      <NitroFlame stateRef={drift} variant="car" />
    </group>
  );
}

export default memo(Su7Car);
