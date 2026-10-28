import { useFrame } from '@react-three/fiber';
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { applyInstanceAlpha, instanceAlphaAttribute } from '../../lib/materials/instanceAlpha';

/**
 * 氮气冲刺的速度线。
 *
 * 一池细长条，在玩家周围生成，沿移动方向摆平（不扭、不转），然后以相对玩家向后的速度
 * 退出画面，同时透明度从 1 线性掉到 0，寿命 0.2~0.4 秒。相加混合，叠在一起是疾风流线感。
 *
 * 两点有意为之：
 *  - 条子是**世界空间**的，不挂在玩家身上，所以人往前冲它们才会真的被甩在后面；
 *  - 用细长方体而不是面片 —— 面片侧着看会直接消失，方体从任何角度都是一条线。
 */

const COUNT = 180;
const Z = new THREE.Vector3(0, 0, 1);

const SpeedLines = forwardRef(function SpeedLines(_, ref) {
  const mesh = useRef();
  const s = useRef({
    next: 0,
    life: new Float32Array(COUNT),
    max: new Float32Array(COUNT),
    len: new Float32Array(COUNT),
    thick: new Float32Array(COUNT),
    pos: new Float32Array(COUNT * 3),
    vel: new Float32Array(COUNT * 3),
    // 每条线各自记朝向：生成时朝哪就一直朝哪，之后人转向了也不会把老线条带着扭
    rot: new Float32Array(COUNT * 4),
    alpha: null,
    spawn: 0, // 没攒够一整条时的余量
    p: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    sc: new THREE.Vector3(),
    m4: new THREE.Matrix4(),
    zero: new THREE.Matrix4().makeScale(0, 0, 0),
  }).current;

  const { geometry, material } = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const alpha = instanceAlphaAttribute(COUNT);
    g.setAttribute('aAlpha', alpha);
    s.alpha = alpha;
    const mat = applyInstanceAlpha(
      new THREE.MeshBasicMaterial({
        color: '#f4fbff',
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    return { geometry: g, material: mat };
  }, [s]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < COUNT; i++) m.setMatrixAt(i, s.zero);
    m.instanceMatrix.needsUpdate = true;
  }, [s]);

  useImperativeHandle(ref, () => ({
    /**
     * 按时间喷发。
     * @param {THREE.Vector3} origin 玩家位置
     * @param {THREE.Vector3} dir    单位移动方向
     * @param {number} speed 当前速度
     * @param {number} dt
     * @param {number} rate 每秒生成多少条
     */
    emit(origin, dir, speed, dt, rate) {
      s.spawn += rate * dt;
      const n = Math.floor(s.spawn);
      if (n <= 0) return;
      s.spawn -= n;

      // 水平方向上垂直于移动方向的基向量，配合世界"上"方向，在移动轴周围的管壁上撒点
      const ul = Math.hypot(-dir.z, dir.x) || 1;
      const ux = -dir.z / ul;
      const uz = dir.x / ul;
      // 这一帧的朝向只算一次，存给每条线
      s.q.setFromUnitVectors(Z, dir);

      for (let k = 0; k < n; k++) {
        const i = s.next;
        s.next = (s.next + 1) % COUNT;
        const r = 0.7 + Math.random() * 2.6; // 离移动轴多远
        const a = Math.random() * Math.PI * 2;
        // 多半生在身后和身侧，向前拖出平行流线；少量擦身而过
        const along = -1.2 - Math.random() * 3.8 + Math.random() * 1.4;

        const o = i * 3;
        s.pos[o] = origin.x + ux * Math.cos(a) * r + dir.x * along;
        // 轴心放在胸口高度，纵向撒开但别钻到地里
        s.pos[o + 1] = origin.y + Math.max(0.2, 1.05 + Math.sin(a) * r * 0.55);
        s.pos[o + 2] = origin.z + uz * Math.cos(a) * r + dir.z * along;
        // 相对玩家往后退：跟移动方向平行，不横向乱飞，才是疾风流线
        const back = speed * (0.55 + Math.random() * 0.25);
        s.vel[o] = -dir.x * back;
        s.vel[o + 1] = 0;
        s.vel[o + 2] = -dir.z * back;

        const r4 = i * 4;
        s.rot[r4] = s.q.x;
        s.rot[r4 + 1] = s.q.y;
        s.rot[r4 + 2] = s.q.z;
        s.rot[r4 + 3] = s.q.w;

        s.max[i] = 0.2 + Math.random() * 0.2; // 0.2~0.4 秒
        s.life[i] = s.max[i];
        s.len[i] = 2.2 + Math.random() * 2.8;
        s.thick[i] = 0.018 + Math.random() * 0.022;
      }
    },
  }));

  useFrame((_state, dtRaw) => {
    const m = mesh.current;
    if (!m) return;
    // 和玩家那边一样截断 dt：线条只活 0.2~0.4 秒，一次掉帧就会让它们在首次更新时
    // 直接判死、连一帧都没画出来
    const dt = Math.min(dtRaw, 0.05);
    let dirty = false;
    for (let i = 0; i < COUNT; i++) {
      if (s.life[i] <= 0) continue;
      s.life[i] -= dt;
      dirty = true;
      if (s.life[i] <= 0) {
        m.setMatrixAt(i, s.zero);
        s.alpha.array[i] = 0;
        continue;
      }
      const o = i * 3;
      s.pos[o] += s.vel[o] * dt;
      s.pos[o + 2] += s.vel[o + 2] * dt;
      s.p.set(s.pos[o], s.pos[o + 1], s.pos[o + 2]);
      const r4 = i * 4;
      s.q.set(s.rot[r4], s.rot[r4 + 1], s.rot[r4 + 2], s.rot[r4 + 3]);
      s.sc.set(s.thick[i], s.thick[i], s.len[i]);
      s.m4.compose(s.p, s.q, s.sc);
      m.setMatrixAt(i, s.m4);
      // 线性淡出
      s.alpha.array[i] = s.life[i] / s.max[i];
    }
    if (dirty) {
      m.instanceMatrix.needsUpdate = true;
      s.alpha.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, COUNT]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      renderOrder={3}
    />
  );
});

export default SpeedLines;
