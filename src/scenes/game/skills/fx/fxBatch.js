import * as THREE from 'three';
import { applyInstanceAlpha, instanceAlphaAttribute } from '../../../../lib/materials/instanceAlpha';

/**
 * 特效粒子合批：一组同几何的粒子用一个 InstancedMesh 画。
 *
 * items 是不进场景的 Object3D 代理，逐帧照旧改 position / rotation / scale / opacity，
 * 改完调 sync() 写进实例矩阵与 aAlpha。颜色按 colors[i] 走 instanceColor。
 */

export class FxParticle extends THREE.Object3D {
  constructor(opacity) {
    super();
    this.opacity = opacity;
  }
}

/**
 * @param {THREE.BufferGeometry} geometry 会被加上 aAlpha，不要和别的批次共用
 * @param {THREE.Material} material 不透明材质可传 { alpha:false }，此时 opacity 不生效
 * @param {THREE.ColorRepresentation[]} colors 每颗粒子的颜色，长度即粒子数
 */
export function makeFxBatch(geometry, material, colors, { opacity = 1, alpha = true } = {}) {
  const count = colors.length;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) mesh.setColorAt(i, tmp.set(colors[i]));
  let alphaAttr = null;
  if (alpha) {
    alphaAttr = instanceAlphaAttribute(count);
    alphaAttr.array.fill(opacity);
    geometry.setAttribute('aAlpha', alphaAttr);
    applyInstanceAlpha(material);
  }
  const items = Array.from({ length: count }, () => new FxParticle(opacity));

  function sync() {
    for (let i = 0; i < count; i++) {
      const p = items[i];
      p.updateMatrix();
      mesh.setMatrixAt(i, p.matrix);
      if (alphaAttr) alphaAttr.array[i] = p.opacity;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (alphaAttr) alphaAttr.needsUpdate = true;
  }

  return { mesh, items, sync };
}
