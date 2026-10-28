import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import FacetMesh from '../../../lib/components/FacetMesh';
import { makeBlobGeometry } from '../../../lib/geometry/organic';
import { makeLoftGeometry } from '../../../lib/geometry/loft';
import { pivotGeometry, sub3 } from '../../../lib/geometry/pivot';
import { fabricTextures } from '../../../lib/textures/procedural';
import { C } from './palette';
import { IDLE_RIG } from './rigs';

/**
 * 双腿通道：pose.legs[右, 左] 的 thigh / knee / ankle。
 * 正值大腿向前、膝向后弯、脚尖下压。几何按 rigs 关节生成，动作只改旋转。
 */

/** 裤腿的一段：keys 用世界坐标写，再平移到以 pivot 为原点 */
function pantSegment({ keys, pivot, seed, kneeAt }) {
  return pivotGeometry(
    makeLoftGeometry({
      keys,
      samples: 9,
      segments: 10,
      bumps: { count: 2, amount: 0.03, phase: 0.1 },
      jitter: 0.015,
      // 膝盖前凸（kneeAt 是膝盖在这段里的 t 位置，没有就不凸）
      profile: (t, theta) =>
        1 + (kneeAt === undefined ? 0 : 0.06 * Math.exp(-(((t - kneeAt) / 0.18) ** 2)) * Math.max(0, Math.sin(theta))),
      color: C.pants,
      faceTint: 0.05,
      uvMeters: 0.07,
      seed,
    }),
    pivot,
  );
}

/** 登山靴：靴筒 + 鞋面 + 鞋头 + 鞋底 + 鞋带 */
function Boot({ position, rotY, seed }) {
  const tex = useMemo(() => fabricTextures('nubuck'), []);
  const g = useMemo(() => {
    const shaft = makeLoftGeometry({
      keys: [
        { p: [0, 0.24, -0.015], a: 0.064, b: 0.062 },
        { p: [0, 0.19, -0.012], a: 0.066, b: 0.066 },
        { p: [0, 0.1, 0.0], a: 0.064, b: 0.07 },
      ],
      samples: 5,
      segments: 8,
      // 靴口一圈深色
      color: (t) => (t < 0.12 ? C.bootDark : C.boot),
      faceTint: 0.06,
      seed,
    });
    const foot = makeLoftGeometry({
      keys: [
        { p: [0, 0.07, -0.085], a: 0.056, b: 0.058 },
        { p: [0, 0.066, -0.01], a: 0.062, b: 0.056 },
        { p: [0, 0.056, 0.1], a: 0.064, b: 0.046 },
        { p: [0, 0.046, 0.18], a: 0.052, b: 0.036 },
        { p: [0, 0.04, 0.225], a: 0.022, b: 0.024 },
      ],
      ref: [0, 1, 0],
      samples: 9,
      segments: 8,
      color: C.boot,
      faceTint: 0.06,
      seed: seed + 1,
    });
    const sole = makeLoftGeometry({
      keys: [
        { p: [0, 0.014, -0.095], a: 0.06, b: 0.016 },
        { p: [0, 0.014, 0.05], a: 0.068, b: 0.016 },
        { p: [0, 0.016, 0.23], a: 0.052, b: 0.016 },
      ],
      ref: [0, 1, 0],
      samples: 7,
      segments: 6,
      color: C.sole,
      faceTint: 0.05,
      seed: seed + 2,
    });
    const lace = makeBlobGeometry({ radius: 0.014, detail: 0, scale: [2.4, 0.5, 0.9], jitter: 0.02, color: C.lace, seed });
    return { shaft, foot, sole, lace };
  }, [seed]);

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <FacetMesh geometry={g.sole} roughness={0.95} side={2} />
      <FacetMesh geometry={g.foot} roughness={0.85} side={2} texture={tex} bumpScale={1} />
      <FacetMesh geometry={g.shaft} roughness={0.85} side={2} texture={tex} bumpScale={1} />
      {/* 鞋带：三道横条 */}
      {[0.0, 0.045, 0.09].map((z, i) => (
        <FacetMesh key={i} geometry={g.lace} position={[0, 0.128 - i * 0.012, z]} rotation={[-0.18, 0, 0]} castShadow={false} />
      ))}
    </group>
  );
}

/** 一条腿：髋（整条腿前后摆）→ 膝（小腿弯曲）→ 踝（脚掌俯仰） */
function Leg({ joints, jointRef }) {
  const { hip, knee, ankle, boot, bootRotY, seed } = joints;
  const tex = useMemo(() => fabricTextures('twill'), []);
  const g = useMemo(() => {
    // 大腿：髋 → 膝（略微过一点，和小腿段重叠）
    const thighEnd = [knee[0] + (knee[0] - hip[0]) * 0.1, knee[1] - 0.03, knee[2] + (knee[2] - hip[2]) * 0.1];
    const thigh = pantSegment({
      keys: [
        { p: hip, a: 0.112, b: 0.106 },
        { p: [(hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2, (hip[2] + knee[2]) / 2], a: 0.104, b: 0.1 },
        { p: thighEnd, a: 0.098, b: 0.096 },
      ],
      pivot: hip,
      seed,
    });
    // 小腿：膝（略微往上一点）→ 踝 → 裤脚
    const shinStart = [knee[0] - (knee[0] - hip[0]) * 0.12, knee[1] + 0.035, knee[2] - (knee[2] - hip[2]) * 0.12];
    const shin = pantSegment({
      keys: [
        { p: shinStart, a: 0.1, b: 0.098 },
        { p: ankle, a: 0.082, b: 0.08 },
        { p: [ankle[0] + (ankle[0] - knee[0]) * 0.1, ankle[1] - 0.055, ankle[2] + 0.005], a: 0.088, b: 0.086 },
      ],
      pivot: knee,
      seed: seed + 1,
      kneeAt: 0.06,
    });
    // 膝盖团：盖住两段之间的接缝
    const kneeCap = makeBlobGeometry({ radius: 0.1, detail: 1, scale: [1, 0.72, 1], jitter: 0.04, color: C.pants, seed: seed + 2 });
    return { thigh, shin, kneeCap };
  }, [hip, knee, ankle, seed]);

  const refs = useRef({});
  jointRef(refs);

  return (
    <group position={hip} ref={(r) => { refs.current.thigh = r; }}>
      <FacetMesh geometry={g.thigh} roughness={0.85} side={2} texture={tex} bumpScale={0.8} />
      <FacetMesh geometry={g.kneeCap} position={sub3(knee, hip)} roughness={0.85} />
      <group position={sub3(knee, hip)} ref={(r) => { refs.current.shin = r; }}>
        <FacetMesh geometry={g.shin} roughness={0.85} side={2} texture={tex} bumpScale={0.8} />
        <group position={sub3(ankle, knee)} ref={(r) => { refs.current.foot = r; }}>
          <Boot position={sub3(boot, ankle)} rotY={bootRotY} seed={seed + 20} />
        </group>
      </group>
    </group>
  );
}

export default function Legs({ rig = IDLE_RIG.legs, poseRef }) {
  const pelvis = useMemo(
    () =>
      makeLoftGeometry({
        keys: [
          { p: [-0.02, 0.6, 0], a: 0.205, b: 0.138 },
          { p: [-0.02, 0.74, 0], a: 0.21, b: 0.14 },
        ],
        samples: 3,
        segments: 12,
        color: C.pants,
        seed: 51,
      }),
    [],
  );

  const joints = useRef([]);
  useFrame(() => {
    const pose = poseRef?.current;
    if (!pose) return;
    for (let i = 0; i < joints.current.length; i++) {
      const r = joints.current[i]?.current;
      const a = pose.legs[i];
      if (!r || !a) continue;
      // 大腿前摆 = 绕 X 轴负向转；膝向后弯 = 正向；踝正值是脚尖下压
      if (r.thigh) r.thigh.rotation.x = -a.thigh;
      if (r.shin) r.shin.rotation.x = a.knee;
      if (r.foot) r.foot.rotation.x = a.ankle;
    }
  });

  return (
    <group>
      <FacetMesh geometry={pelvis} roughness={0.9} />
      {rig.map((leg, i) => (
        <Leg key={i} joints={leg} jointRef={(r) => { joints.current[i] = r; }} />
      ))}
    </group>
  );
}
