import * as THREE from 'three';

/**
 * 「把原照片投影回 3D 网格」着色器（投影贴图 + 遮挡检测）。
 *
 * 背景：单图转 3D 模型的颜色分辨率很低、偏糊。但“照片拍摄视角”下我们其实有一张高清图，
 * 所以：面向拍摄相机、且没有被别的部分挡住的表面 → 直接用照片像素；
 *       其它表面（侧面、背面、被遮挡处）→ 用模型补全的顶点色，并在交界处平滑过渡。
 *
 * 需要一个 4x4 的“模型空间 → 照片相机裁剪空间”矩阵（列主序），
 * 其 NDC 的 x、y ∈ [-1, 1] 对应整张照片（左下为 -1,-1）。
 */

/** 深度预渲染：从拍摄相机看网格，把 gl_FragCoord.z 写进 R 通道，供主着色器做遮挡判断 */
export function createProjectionDepthMaterial(projMatrix) {
  return new THREE.ShaderMaterial({
    uniforms: { uProjMatrix: { value: projMatrix } },
    vertexShader: /* glsl */ `
      uniform mat4 uProjMatrix;
      void main() {
        gl_Position = uProjMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      void main() {
        gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

/**
 * 在给定的 renderer 里把深度预渲染到一张 float 贴图，返回 { target, dispose }。
 * @param {THREE.WebGLRenderer} gl
 * @param {THREE.BufferGeometry[]} geometries 需要参与遮挡的网格几何（模型空间）
 * @param {THREE.Matrix4} projMatrix 模型空间 → 照片相机裁剪空间
 * @param {number} [width]
 * @param {number} [height]
 */
export function renderProjectionDepth(gl, geometries, projMatrix, width = 1152, height = 2048) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    generateMipmaps: false,
  });
  const material = createProjectionDepthMaterial(projMatrix);
  const scene = new THREE.Scene();
  geometries.forEach((g) => {
    const m = new THREE.Mesh(g, material);
    m.frustumCulled = false;
    scene.add(m);
  });
  const prevTarget = gl.getRenderTarget();
  const prevClear = new THREE.Color();
  gl.getClearColor(prevClear);
  const prevAlpha = gl.getClearAlpha();

  gl.setRenderTarget(target);
  gl.setClearColor(0xffffff, 1); // R=1 → 最远
  gl.clear();
  gl.render(scene, new THREE.Camera());

  gl.setRenderTarget(prevTarget);
  gl.setClearColor(prevClear, prevAlpha);
  material.dispose();
  return { target, dispose: () => target.dispose() };
}

/**
 * 创建带照片投影的最终材质。
 * @param {object} o
 * @param {THREE.Texture} o.photo 原照片（会被设置为不做色彩空间转换）
 * @param {THREE.Matrix4} o.projMatrix 模型空间 → 照片相机裁剪空间
 * @param {THREE.Texture} o.depthTexture renderProjectionDepth 的结果
 * @param {THREE.Vector3} o.frontDir 模型空间里“表面朝向拍摄相机”的方向（单位向量）
 * @param {number} [o.mix] 照片的最大混合强度 0~1
 * @param {number} [o.shade] 视角相关明暗强度（让背面也有立体感）
 */
export function createPhotoProjectedMaterial({ photo, projMatrix, depthTexture, frontDir, mix = 1, shade = 0.18 }) {
  photo.colorSpace = THREE.NoColorSpace;
  photo.anisotropy = 8;
  photo.needsUpdate = true;
  return new THREE.ShaderMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    uniforms: {
      uPhoto: { value: photo },
      uDepthTex: { value: depthTexture },
      uProjMatrix: { value: projMatrix },
      uFrontDir: { value: frontDir.clone().normalize() },
      uMix: { value: mix },
      uShade: { value: shade },
    },
    vertexShader: /* glsl */ `
      uniform mat4 uProjMatrix;
      varying vec3 vColor;
      varying vec4 vProj;
      varying vec3 vNormalLocal;
      varying vec3 vNormalView;
      void main() {
        vColor = color;
        vNormalLocal = normal;
        vNormalView = normalMatrix * normal;
        vProj = uProjMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPhoto;
      uniform sampler2D uDepthTex;
      uniform vec3 uFrontDir;
      uniform float uMix;
      uniform float uShade;
      varying vec3 vColor;
      varying vec4 vProj;
      varying vec3 vNormalLocal;
      varying vec3 vNormalView;

      void main() {
        vec3 nL = normalize(vNormalLocal);
        // 双面渲染：背面片元的法线朝向翻转，保证明暗与朝向判断正确
        if (!gl_FrontFacing) nL = -nL;
        vec3 nV = normalize(vNormalView);
        if (!gl_FrontFacing) nV = -nV;

        vec3 ndc = vProj.xyz / vProj.w;
        vec2 uv = ndc.xy * 0.5 + 0.5;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);

        // 遮挡：照片相机能看到的最近深度 vs 自己的深度
        float nearest = texture2D(uDepthTex, uv).r;
        float visible = step(ndc.z * 0.5 + 0.5 - 0.003, nearest);

        // 朝向：正对拍摄相机 → 1；擦边或背对 → 0（平滑过渡，避免拉伸贴图）
        float facing = smoothstep(0.2, 0.6, dot(nL, uFrontDir));

        float w = inside * visible * facing * uMix;
        vec3 photo = texture2D(uPhoto, uv).rgb;
        vec3 base = mix(vColor, photo, w);

        // 头灯式柔和明暗：保持颜色基本不变，只增加一点体积感
        float lambert = max(dot(nV, normalize(vec3(-0.25, 0.4, 0.85))), 0.0);
        float lit = 1.0 - uShade + uShade * lambert * 1.25;
        gl_FragColor = vec4(base * lit, 1.0);
      }
    `,
  });
}
