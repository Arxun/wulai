import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { tryLightAttack, trySkill, tryWhirl, tryWulai } from '../../../lib/animation/combatMoves';
import { combat, equipWeapon, spawnLoot, WEAPON_ORDER, world } from '../stores/combatStore';

/**
 * 开发用性能探针：`?perf=1` 只记录，`?perf=auto` 额外按脚本依次放技能 / 换武器。
 * 每段记录最大帧耗时、新编译 program 数、draw call、可见点光数，结束后 console 输出 [PERF-PROBE]。
 */

const STEPS = [
  { label: 'idle', wait: 2500 },
  { label: 'J 连招第1下', run: () => tryLightAttack(world), wait: 900 },
  { label: 'J 连招第2下', run: () => tryLightAttack(world), wait: 900 },
  { label: 'K 崩击', run: () => trySkill(world), wait: 1600 },
  { label: 'E 回旋斩', run: () => tryWhirl(world), wait: 3400 },
  { label: 'R 武来', run: () => tryWulai(world), wait: 5200 },
  ...WEAPON_ORDER.slice(1).map((id) => ({ label: `换武器 ${id}`, run: () => equipWeapon(id), wait: 900 })),
  { label: '血剑 J', run: () => tryLightAttack(world), wait: 900 },
  { label: '地上掉落一件', run: () => spawnLoot(world.x + 2, world.z + 2, 'hp'), wait: 900 },
  { label: 'J 再一次（已编译过）', run: () => tryLightAttack(world), wait: 900 },
];

function countVisiblePointLights(scene) {
  let n = 0;
  const walk = (o) => {
    if (!o.visible) return;
    if (o.isPointLight) n += 1;
    for (const c of o.children) walk(c);
  };
  walk(scene);
  return n;
}

export default function PerfProbe({ auto = false }) {
  const { gl, scene } = useThree();
  const last = useRef(0);
  const seg = useRef(null);
  const results = useRef([]);

  const beginSeg = (label) => {
    seg.current = {
      label,
      maxMs: 0,
      frames: 0,
      sumMs: 0,
      programsBefore: gl.info.programs?.length ?? 0,
      maxCalls: 0,
      maxTris: 0,
      lightsSeen: new Set(),
    };
  };

  const endSeg = () => {
    const s = seg.current;
    if (!s) return;
    results.current.push({
      step: s.label,
      maxFrameMs: Math.round(s.maxMs * 10) / 10,
      avgFrameMs: Math.round((s.sumMs / Math.max(1, s.frames)) * 10) / 10,
      newPrograms: (gl.info.programs?.length ?? 0) - s.programsBefore,
      maxDrawCalls: s.maxCalls,
      maxTriangles: s.maxTris,
      pointLights: [...s.lightsSeen].sort((a, b) => a - b).join('/'),
    });
  };

  useEffect(() => {
    window.__perfScene = scene;
    window.__perfGl = gl;
    if (!auto) {
      beginSeg('manual');
      const id = setInterval(() => {
        endSeg();
        console.info('[PERF-PROBE]', JSON.stringify(results.current.splice(0)));
        beginSeg('manual');
      }, 5000);
      return () => clearInterval(id);
    }
    let cancelled = false;
    for (const id of WEAPON_ORDER) combat.owned[id] = true;
    (async () => {
      await new Promise((r) => setTimeout(r, 4000));
      for (const step of STEPS) {
        if (cancelled) return;
        beginSeg(step.label);
        step.run?.();
        await new Promise((r) => setTimeout(r, step.wait));
        endSeg();
      }
      const info = {
        programsTotal: gl.info.programs?.length ?? 0,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        sceneMeshes: (() => {
          let n = 0;
          let mats = new Set();
          scene.traverse((o) => {
            if (o.isMesh) {
              n += 1;
              mats.add(o.material);
            }
          });
          return { meshes: n, uniqueMaterials: mats.size };
        })(),
      };
      console.info('[PERF-PROBE]', JSON.stringify({ steps: results.current, info }));
      window.__perfProbe = { steps: results.current, info };
    })();
    return () => {
      cancelled = true;
    };
  }, [auto, gl, scene]);

  useFrame(() => {
    const now = performance.now();
    const dt = last.current ? now - last.current : 0;
    last.current = now;
    const s = seg.current;
    if (!s || dt <= 0) return;
    s.frames += 1;
    s.sumMs += dt;
    if (dt > s.maxMs) s.maxMs = dt;
    s.maxCalls = Math.max(s.maxCalls, gl.info.render.calls);
    s.maxTris = Math.max(s.maxTris, gl.info.render.triangles);
    if (s.frames % 3 === 0) s.lightsSeen.add(countVisiblePointLights(scene));
  });

  return null;
}
