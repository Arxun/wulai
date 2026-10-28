/**
 * 首次放技能卡顿多半是 GPU 第一次编译透明/ADD 着色器。
 * 进图后空闲时把标记过的特效子树以极低透明度跑一遍 compile。
 */

import * as THREE from 'three';

const EPS = 0.003;

export function markSkillFxWarmupRoot(object3d) {
  if (object3d) object3d.userData.wulaiSkillFxWarmup = true;
}

export function countSkillFxWarmupRoots(scene) {
  let n = 0;
  scene.traverse((o) => {
    if (o.userData?.wulaiSkillFxWarmup) n += 1;
  });
  return n;
}

function collectWarmupRoots(scene) {
  const roots = [];
  scene.traverse((o) => {
    if (o.userData?.wulaiSkillFxWarmup && !roots.includes(o)) roots.push(o);
  });
  return roots;
}

function snapshotForWarmup(roots) {
  const entries = [];
  for (const root of roots) {
    entries.push({ kind: 'obj', obj: root, visible: root.visible });
    root.visible = true;
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      entries.push({ kind: 'obj', obj: o, visible: o.visible });
      o.visible = true;
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
    } else {
      e.obj.visible = e.visible;
    }
  }
}

/**
 * @param {THREE.WebGLRenderer} gl
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 */
export async function warmupSkillFxShaders(gl, scene, camera, { fullScene = false } = {}) {
  const roots = collectWarmupRoots(scene);
  const entries = roots.length ? snapshotForWarmup(roots) : [];
  try {
    if (roots.length) {
      if (typeof gl.compileAsync === 'function') {
        await gl.compileAsync(scene, camera);
      } else {
        gl.compile(scene, camera);
      }
    }
    if (fullScene && typeof gl.compileAsync === 'function') {
      await gl.compileAsync(scene, camera);
    } else if (fullScene) {
      gl.compile(scene, camera);
    }
  } finally {
    if (entries.length) restoreSnapshot(entries);
  }
  return roots.length;
}
