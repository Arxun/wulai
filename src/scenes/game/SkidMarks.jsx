import { useFrame } from '@react-three/fiber';
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { applyInstanceAlpha, instanceAlphaAttribute } from '../../lib/materials/instanceAlpha';
import { SKID_LIFE } from './stores/driftStore';

/**
 * 鞋底摩擦印子。
 *
 * 一个固定大小的 InstancedMesh 当环形缓冲用：漂移时每隔一小段距离按左右脚各盖一个印子，
 * 用满了就从最旧的开始覆盖。没有分配 / 回收，不会在跑动中触发 GC 卡顿。
 * 逐个印子的淡出靠 instanceAlpha（见 lib/materials/instanceAlpha.js）。
 */

// 左右脚各一半：全速漂移每秒大约盖 56 个，520 个够撑住十秒的保留时间
const COUNT = 520;
const FADE = 2.2; // 最后这几秒淡出
const UP = new THREE.Vector3(0, 1, 0);

function makeMaterial() {
  const mat = new THREE.MeshBasicMaterial({
    // 刮出来的湿土色：比泥路深、比草地浅，踩在路上和草地上都看得见
    // （纯黑的印子在背阴的草坡上会直接糊掉）
    color: '#5c4428',
    transparent: true,
    depthWrite: false,
    // 贴在地面上，靠偏移避免和地形共面闪烁（z-fighting）
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
  });
  return applyInstanceAlpha(mat);
}

/**
 * 用 ref 暴露 emit()：玩家控制器直接调，不走 props / state。
 * emit(pos, yaw, normal, strength)
 */
const SkidMarks = forwardRef(function SkidMarks(_, ref) {
  const mesh = useRef();
  const s = useRef({
    next: 0,
    life: new Float32Array(COUNT),
    base: new Float32Array(COUNT), // 每个印子的初始浓度
    alpha: null,
    pos: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    spin: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
    mat4: new THREE.Matrix4(),
    zero: new THREE.Matrix4().makeScale(0, 0, 0),
    hasActive: false,
  }).current;

  const { geometry, material } = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2); // 平铺在地上
    const alpha = instanceAlphaAttribute(COUNT);
    g.setAttribute('aAlpha', alpha);
    s.alpha = alpha;
    return { geometry: g, material: makeMaterial() };
  }, [s]);

  useImperativeHandle(ref, () => ({
    emit(pos, yaw, normal, strength = 1, opts = {}) {
      const m = mesh.current;
      if (!m) return;
      const i = s.next;
      s.next = (s.next + 1) % COUNT;
      s.life[i] = SKID_LIFE;

      // 贴合坡面：先把"上"转到地面法线，再绕法线转到脚的朝向
      s.quat.setFromUnitVectors(UP, normal);
      s.spin.setFromAxisAngle(UP, yaw);
      s.quat.multiply(s.spin);
      // 印子沿滑动方向拉长，摩擦越狠越宽越长；长度大于盖印间距，所以会连成一条
      const tire = opts.tire === true;
      s.scale.set(
        tire ? 0.11 + strength * 0.09 : 0.09 + strength * 0.07,
        1,
        tire ? 0.72 + strength * 0.38 : 0.5 + strength * 0.28,
      );
      s.mat4.compose(pos, s.quat, s.scale);
      m.setMatrixAt(i, s.mat4);
      m.instanceMatrix.needsUpdate = true;
      s.base[i] = 0.62 + strength * 0.28;
      s.alpha.array[i] = s.base[i];
      s.alpha.needsUpdate = true;
      s.hasActive = true;
    },
    clear() {
      const m = mesh.current;
      if (!m) return;
      for (let i = 0; i < COUNT; i++) {
        s.life[i] = 0;
        m.setMatrixAt(i, s.zero);
      }
      m.instanceMatrix.needsUpdate = true;
      s.hasActive = false;
    },
  }));

  // 实例矩阵默认是单位矩阵，不清零的话一上场原点会堆 480 个方片
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < COUNT; i++) m.setMatrixAt(i, s.zero);
    m.instanceMatrix.needsUpdate = true;
  }, [s]);

  useFrame((_state, dt) => {
    if (!s.hasActive) return;
    const m = mesh.current;
    if (!m) return;
    let dirty = false;
    for (let i = 0; i < COUNT; i++) {
      if (s.life[i] <= 0) continue;
      s.life[i] -= dt;
      dirty = true;
      if (s.life[i] <= 0) {
        m.setMatrixAt(i, s.zero);
        m.instanceMatrix.needsUpdate = true;
        s.alpha.array[i] = 0;
      } else {
        // 快到十秒了才开始淡，前面一直是实的
        s.alpha.array[i] = s.base[i] * Math.min(1, s.life[i] / FADE);
      }
    }
    if (dirty) s.alpha.needsUpdate = true;
    else s.hasActive = false;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, COUNT]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      renderOrder={2}
    />
  );
});

export default SkidMarks;
