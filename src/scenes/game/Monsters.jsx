import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { fx } from './combatStore';
import { MonsterMesh, makeMonsterGeo } from './monsterMeshes';
import { MONSTER_KINDS } from './monsterKinds';
import { getMonsterPack } from './monsterPack';
import { tickMonster } from './monsterSim';

/**
 * 地图怪物：单 useFrame 驱动全部 AI + 血条，避免 100+ 订阅卡进游戏。
 */

function MonsterVisual({ state, geo, register, unregister }) {
  const group = useRef();
  const body = useRef();
  const bar = useRef();
  const fill = useRef();
  const spec = MONSTER_KINDS[state.kind];

  useLayoutEffect(() => {
    register(state.id, { group, body, bar, fill });
    return () => unregister(state.id);
  }, [state.id, register, unregister]);

  return (
    <group ref={group} scale={spec.scale}>
      <group ref={body}>
        <MonsterMesh kind={state.kind} geo={geo} />
      </group>
      <group ref={bar} position={[0, spec.hpY, 0]}>
        <mesh>
          <planeGeometry args={[0.7, 0.07]} />
          <meshBasicMaterial color="#1a1010" depthTest={false} />
        </mesh>
        <mesh ref={fill} position={[0, 0, 0.002]}>
          <planeGeometry args={[0.7, 0.05]} />
          <meshBasicMaterial color="#e0543a" depthTest={false} />
        </mesh>
      </group>
    </group>
  );
}

export default function Monsters() {
  const geo = useMemo(() => makeMonsterGeo(), []);
  const pack = useMemo(() => getMonsterPack(), []);
  const refs = useRef(new Map());
  const frame = useRef(0);

  const register = useMemo(
    () => (id, r) => {
      refs.current.set(id, r);
    },
    [],
  );
  const unregister = useMemo(
    () => (id) => {
      refs.current.delete(id);
    },
    [],
  );

  useFrame(({ camera }, dtRaw) => {
    frame.current += 1;
    const frozen = fx.stop > 0;
    const dt = Math.min(dtRaw, 0.05) * (frozen ? 0.14 : 1);
    const ctx = { dt, dtRaw, camera, frame: frame.current };
    for (let i = 0; i < pack.length; i++) {
      const m = pack[i];
      const r = refs.current.get(m.id);
      if (r) tickMonster(m, r, ctx);
    }
  });

  return (
    <group>
      {pack.map((m) => (
        <MonsterVisual
          key={m.id}
          state={m}
          geo={geo[m.kind]}
          register={register}
          unregister={unregister}
        />
      ))}
    </group>
  );
}
