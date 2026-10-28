import * as THREE from 'three';

/**
 * 收集对象树里所有 Mesh。
 * @param {THREE.Object3D} root
 * @returns {THREE.Mesh[]}
 */
export function collectMeshes(root) {
  const out = [];
  root.traverse((o) => {
    if (o.isMesh) out.push(o);
  });
  return out;
}

/**
 * 把模型缩放到指定高度，脚底落在 y = 0，水平方向居中（只改 root 的 position / scale，不动顶点）。
 * 注意：着色器里用的是顶点的“局部坐标”，所以这里的缩放平移不影响投影贴图。
 *
 * @param {THREE.Object3D} root
 * @param {number} targetHeight 目标高度
 * @returns {{ size: THREE.Vector3, scale: number }} 归一化前的包围盒尺寸与所用缩放
 */
export function normalizeModel(root, targetHeight = 1.8) {
  root.position.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 1e-6);

  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  return { size, scale };
}

/**
 * GLB 里的 COLOR_0 可能是 vec4，而自定义着色器按 vec3 读取；统一成 vec3。
 * @param {THREE.BufferGeometry} geometry
 */
export function ensureVec3Colors(geometry) {
  const c = geometry.getAttribute('color');
  if (!c || c.itemSize === 3) return;
  const out = new Float32Array(c.count * 3);
  for (let i = 0; i < c.count; i++) {
    out[i * 3] = c.getX(i);
    out[i * 3 + 1] = c.getY(i);
    out[i * 3 + 2] = c.getZ(i);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(out, 3));
}
