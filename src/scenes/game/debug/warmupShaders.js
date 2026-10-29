/**
 * 首次放技能卡顿多半是 GPU 第一次编译透明/ADD 着色器。
 * 进图后空闲时把标记过的特效子树以极低透明度跑一遍 compile。
 */

import * as THREE from 'three';

const EPS = 0.003;

export function markSkillFxWarmupRoot(object3d, { tier } = {}) {
  if (!object3d) return;
  object3d.userData.wulaiSkillFxWarmup = true;
  if (tier) object3d.userData.wulaiSkillFxWarmupTier = tier;
}

export function countSkillFxWarmupRoots(scene) {
  let n = 0;
  scene.traverse((o) => {
    if (o.userData?.wulaiSkillFxWarmup) n += 1;
  });
  return n;
}

export function countUltSkillFxWarmupRoots(scene) {
  let n = 0;
  scene.traverse((o) => {
    if (o.userData?.wulaiSkillFxWarmup && o.userData.wulaiSkillFxWarmupTier === 'ult') n += 1;
  });
  return n;
}

function collectWarmupRoots(scene, { tier } = {}) {
  const roots = [];
  scene.traverse((o) => {
    if (!o.userData?.wulaiSkillFxWarmup) return;
    if (tier) {
      if (o.userData.wulaiSkillFxWarmupTier !== tier) return;
    }
    if (!roots.includes(o)) roots.push(o);
  });
  return roots;
}

function snapshotForWarmup(roots) {
  const entries = [];
  for (const root of roots) {
    entries.push({ kind: 'obj', obj: root, visible: root.visible });
    root.visible = true;
    root.traverse((o) => {
      if (o !== root) {
        entries.push({ kind: 'obj', obj: o, visible: o.visible });
        o.visible = true;
      }
      if (o.isPointLight || o.isSpotLight || o.isDirectionalLight) {
        entries.push({ kind: 'light', light: o, intensity: o.intensity });
        o.intensity = Math.max(o.intensity, 0.02);
      }
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        entries.push({
          kind: 'mat',
          mat: m,
          opacity: m.opacity,
          transparent: m.transparent,
        });
        if (m.opacity !== undefined) m.opacity = Math.max(m.opacity, EPS);
        if (!m.transparent && m.opacity !== undefined && m.opacity < 1) m.transparent = true;
      }
    });
  }
  return entries;
}

function restoreSnapshot(entries) {
  for (const e of entries) {
    if (e.kind === 'mat') {
      e.mat.opacity = e.opacity;
      e.mat.transparent = e.transparent;
    } else if (e.kind === 'light') {
      e.light.intensity = e.intensity;
    } else {
      e.obj.visible = e.visible;
    }
  }
}

async function compileScene(gl, scene, camera) {
  if (typeof gl.compileAsync === 'function') {
    await gl.compileAsync(scene, camera);
  } else {
    gl.compile(scene, camera);
  }
  gl.render(scene, camera);
}

/**
 * @param {THREE.WebGLRenderer} gl
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {{ fullScene?: boolean, tier?: string }} opts
 */
export async function warmupSkillFxShaders(gl, scene, camera, { fullScene = false, tier } = {}) {
  const roots = collectWarmupRoots(scene, tier ? { tier } : {});
  const entries = roots.length ? snapshotForWarmup(roots) : [];
  try {
    if (roots.length || fullScene) {
      await compileScene(gl, scene, camera);
    }
  } finally {
    if (entries.length) restoreSnapshot(entries);
  }
  return roots.length;
}
