import * as THREE from 'three';

/**
 * 天空渐变材质：天顶 → 地平线 → 地面三段渐变，贴在大球内壁上。
 * 不受雾和光照影响，适合做阴天 / 薄雾背景。
 */
export function createSkyGradientMaterial({
  top = '#cfdae4',
  horizon = '#e3e9ed',
  bottom = '#c9d3da',
  exponent = 0.7,
} = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uBottom: { value: new THREE.Color(bottom) },
      uExp: { value: exponent },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform float uExp;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = h > 0.0
          ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), uExp))
          : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.5));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
