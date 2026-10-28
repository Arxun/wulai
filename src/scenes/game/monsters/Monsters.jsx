import { useFrame } from '@react-three/fiber';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { fx } from '../stores/combatStore';
import { MonsterMesh, makeMonsterGeo } from './monsterMeshes';
import { MONSTER_KINDS } from './kinds';
import { getMonsterPack } from './pack';
import { guardFrame, reportGameError } from '../debug/reportError';
import { tickMonster } from './sim';

/**
 * 地图怪物：单 useFrame 驱动全部 AI + 血条，避免 100+ 订阅卡进游戏。
 */

const MonsterVisual = memo(function MonsterVisual({ state, geo, register, unregister }) {
  const group = useRef();
  const body = useRef();
  const bar = useRef();
  const fill = useRef();
  const spec = MONSTER_KINDS[state.kind];
  const barW = spec.boss ? 1.55 : 0.7;

  useLayoutEffect(() => {
    register(state.id, { group, body, bar, fill });
    return () => unregister(state.id);
  }, [state.id, register, unregister]);

  return (
    <group ref={group} scale={spec.scale}>
      <group ref={body}>
        <MonsterMesh kind={state.kind} geo={geo} />
      </group>
      <group ref={bar} position={[0, spec.hpY + (spec.boss ? 0.22 : 0), 0]}>
        <mesh>
          <planeGeometry args={[barW, spec.boss ? 0.1 : 0.07]} />
          <meshBasicMaterial color={spec.boss ? '#0a0814' : '#1a1010'} depthTest={false} />
        </mesh>
        <mesh ref={fill} position={[0, 0, 0.002]}>
          <planeGeometry args={[barW, spec.boss ? 0.075 : 0.05]} />
          <meshBasicMaterial color={spec.boss ? '#ff5030' : '#e0543a'} depthTest={false} />
        </mesh>
      </group>
    </group>
  );
});

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

  useFrame(
    guardFrame('monsters/Monsters', ({ camera }, dtRaw) => {
      frame.current += 1;
      const frozen = fx.stop > 0;
      const dt = Math.min(dtRaw, 0.05) * (frozen ? 0.14 : 1);
      const ctx = { dt, dtRaw, camera, frame: frame.current };
      for (let i = 0; i < pack.length; i++) {
        const m = pack[i];
        const r = refs.current.get(m.id);
        if (!r) continue;
        try {
          tickMonster(m, r, ctx);
        } catch (err) {
          reportGameError(`monsters/tick/${m.kind}:${m.id}`, err);
        }
      }
    }),
  );

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
