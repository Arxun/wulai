/**
 * Canvas 销毁前，对场景里所有几何 / 材质 / 贴图调一次 dispose()。
 *
 * useGLTF、程序贴图等缓存会跨 Canvas 复用同一批对象；每个 WebGLRenderer 用过它们时
 * 都会挂一个闭包持有自己的 dispose 监听。不 dispose 的话，屏幕旋转每 remount 一次，
 * 旧渲染器连同整个旧场景都被缓存对象拽住回收不掉（实测每次约 +4MB）。
 * dispose 只让各渲染器释放显存并摘掉监听，对象本身仍可用，新 Canvas 会重新上传。
 */
export function releaseSceneGpu(scene) {
  const done = new Set();
  const release = (res) => {
    if (!res || done.has(res) || typeof res.dispose !== 'function') return;
    done.add(res);
    res.dispose();
  };
  const releaseMaterial = (mat) => {
    if (!mat || done.has(mat)) return;
    for (const key of Object.keys(mat)) {
      const v = mat[key];
      if (v && v.isTexture) release(v);
    }
    if (mat.uniforms) {
      for (const u of Object.values(mat.uniforms)) {
        if (u?.value?.isTexture) release(u.value);
      }
    }
    release(mat);
  };

  scene.traverse((o) => {
    if (o.geometry) release(o.geometry);
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) releaseMaterial(m);
    if (o.isInstancedMesh) release(o);
  });
  if (scene.environment?.isTexture) release(scene.environment);
  if (scene.background?.isTexture) release(scene.background);
}
