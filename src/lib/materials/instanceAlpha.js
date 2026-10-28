import * as THREE from 'three';

/**
 * 给 InstancedMesh 加"逐实例透明度"。
 *
 * InstancedMesh 共用一份材质，没法单独给某个实例设 opacity，所以往 shader 里塞一条
 * instanced 属性 aAlpha，在片元里乘到 alpha 上。拖痕、速度线这类要各自淡出的东西都靠它。
 *
 * 用法：
 *   const alpha = instanceAlphaAttribute(count);
 *   geometry.setAttribute('aAlpha', alpha);
 *   applyInstanceAlpha(material);
 *   // 改完 alpha.array[i] 记得 alpha.needsUpdate = true
 */

export function instanceAlphaAttribute(count) {
  const attr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  return attr;
}

export function applyInstanceAlpha(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float aAlpha;\nvarying float vAlpha;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vAlpha = aAlpha;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying float vAlpha;\nvoid main() {')
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( diffuse, opacity * vAlpha );',
      );
  };
  return material;
}
