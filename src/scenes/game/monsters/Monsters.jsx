import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { fx } from '../stores/combatStore';
import { applyInstanceAlpha, instanceAlphaAttribute } from '../../../lib/materials/instanceAlpha';
import { buildMonsterBatches } from './monsterBatch';
import { MONSTER_KINDS } from './kinds';
import { getMonsterPack } from './pack';
import { guardFrame, reportGameError } from '../debug/reportError';
import { DEATH_FADE, tickMonster } from './sim';

/**
 * 地图怪物：单 useFrame 驱动全部 AI + 血条，避免 100+ 订阅卡进游戏。
 * 身体按「种类 × 粗糙度」合批成 InstancedMesh；每只怪只保留空的 group/body 节点给 AI 写变换。
 */

const DEAD_GRAY = new THREE.Color('#8a8a8a');
const LIVE = new THREE.Color('#ffffff');
/** 死亡后不透明度高于这个值时仍按不透明画（原先逐材质版本此时也写深度） */
const OPAQUE_FADE = 0.92;
const _m = new THREE.Matrix4();

function makeMaterial(rough, dying) {
  const mat = new THREE.MeshStandardMaterial({
    flatShading: true,
    vertexColors: true,
    color: dying ? DEAD_GRAY : LIVE,
    roughness: rough,
    metalness: 0,
  });
  if (dying) {
    mat.transparent = true;
    mat.depthWrite = false;
    applyInstanceAlpha(mat);
  }
  return mat;
}

function makeInstanced(geometry, material, cap) {
  const mesh = new THREE.InstancedMesh(geometry, material, cap);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function buildRenderBatches(pack) {
  const caps = {};
  for (const m of pack) caps[m.kind] = (caps[m.kind] || 0) + 1;
  const baked = buildMonsterBatches();
  const byKind = {};
  const meshes = [];
  for (const kind of Object.keys(caps)) {
    const cap = caps[kind];
    byKind[kind] = (baked[kind] || []).map(({ rough, geometry }) => {
      const alpha = instanceAlphaAttribute(cap);
      geometry.setAttribute('aAlpha', alpha);
      const live = makeInstanced(geometry, makeMaterial(rough, false), cap);
      for (let i = 0; i < cap; i++) live.setColorAt(i, LIVE);
      live.instanceColor.setUsage(THREE.DynamicDrawUsage);
      const dying = makeInstanced(geometry, makeMaterial(rough, true), cap);
      meshes.push(live, dying);
      return { live, dying, alpha };
    });
  }
  return { byKind, meshes };
}

const MonsterVisual = memo(function MonsterVisual({ state, register, unregister }) {
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
      <group ref={body} />
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

/** 把本帧每只怪的 group×body 变换写进对应批次 */
function writeInstances(pack, refs, byKind, counts) {
  for (const kind in counts) counts[kind].live = counts[kind].dying = 0;
  for (let i = 0; i < pack.length; i++) {
    const m = pack[i];
    const batches = byKind[m.kind];
    const r = refs.get(m.id);
    const group = r?.group.current;
    const body = r?.body.current;
    if (!batches || !group || !body || !group.visible) continue;
    group.updateMatrix();
    body.updateMatrix();
    _m.multiplyMatrices(group.matrix, body.matrix);
    const k = m.dead ? m.fade / DEATH_FADE : 1;
    const c = counts[m.kind];
    if (!m.dead || k > OPAQUE_FADE) {
      const idx = c.live++;
      for (const b of batches) {
        b.live.setMatrixAt(idx, _m);
        b.live.setColorAt(idx, m.dead ? DEAD_GRAY : LIVE);
      }
    } else {
      const idx = c.dying++;
      for (const b of batches) {
        b.dying.setMatrixAt(idx, _m);
        b.alpha.array[idx] = k;
      }
    }
  }
  for (const kind in counts) {
    const c = counts[kind];
    for (const b of byKind[kind]) {
      b.live.count = c.live;
      b.live.instanceMatrix.needsUpdate = true;
      b.live.instanceColor.needsUpdate = true;
      b.dying.count = c.dying;
      b.dying.instanceMatrix.needsUpdate = true;
      b.alpha.needsUpdate = true;
    }
  }
}

export default function Monsters() {
  const pack = useMemo(() => getMonsterPack(), []);
  const { byKind, meshes } = useMemo(() => buildRenderBatches(pack), [pack]);
  const counts = useMemo(() => {
    const c = {};
    for (const kind of Object.keys(byKind)) c[kind] = { live: 0, dying: 0 };
    return c;
  }, [byKind]);
  const refs = useRef(new Map());
  const frame = useRef(0);

  useEffect(
    () => () => {
      for (const mesh of meshes) {
        mesh.material.dispose();
        mesh.dispose();
      }
      for (const kind of Object.keys(byKind)) for (const b of byKind[kind]) b.live.geometry.dispose();
    },
    [byKind, meshes],
  );

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
      writeInstances(pack, refs.current, byKind, counts);
    }),
  );

  return (
    <group>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
      {pack.map((m) => (
        <MonsterVisual key={m.id} state={m} register={register} unregister={unregister} />
      ))}
    </group>
  );
}
