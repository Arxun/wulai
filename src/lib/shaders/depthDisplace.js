import * as THREE from 'three';

/**
 * 「照片 + 深度图 → 视差网格」着色器。
 *
 * 做法：把照片铺在一张高密度网格上，沿“原相机 → 像素”的射线按深度前后推移顶点。
 * 因为沿射线移动，所以从拍摄视角看过去与原照片逐像素一致；换视角才出现视差。
 *
 * 深度突变处（人物轮廓、树枝与天空）的三角形会被拉长，
 * 顶点着色器检测邻域深度差，片元着色器只丢弃“真正被拉伸”的三角形，
 * 露出后面补洞过的背景层。
 */

/** 顶点着色器；aspect = 照片 高 / 宽（网格在位置空间里占 宽 1 × 高 aspect） */
export function createDepthDisplaceVertexShader(aspect) {
  return /* glsl */ `
    uniform sampler2D uDepth;
    uniform vec2 uTexel;     // 深度图一个像素的 uv 大小
    uniform float uRange;    // 立体强度：深度 0→1 对应的前后位移范围（世界单位）
    uniform float uPivot;    // 落在照片平面上的深度值（≈ 主体深度）
    uniform float uOffset;   // 整层额外后移（背景层用，避免和前景 z-fight）
    uniform float uD;        // 原相机距离
    varying vec2 vUv;
    varying float vEdge;

    float dep(vec2 uv) { return texture2D(uDepth, uv).r; }

    void main() {
      // uv 由位置推出：网格外扩时 uv 会越界，贴图镜像延展
      vUv = position.xy / vec2(1.0, ${aspect.toFixed(6)}) + 0.5;

      float d = dep(vUv);

      // 邻域最大深度差：用于识别深度断层
      vec2 t = uTexel * 5.0;
      float e = 0.0;
      e = max(e, abs(dep(vUv + vec2( t.x, 0.0)) - d));
      e = max(e, abs(dep(vUv + vec2(-t.x, 0.0)) - d));
      e = max(e, abs(dep(vUv + vec2(0.0,  t.y)) - d));
      e = max(e, abs(dep(vUv + vec2(0.0, -t.y)) - d));
      e = max(e, abs(dep(vUv + vec2( t.x,  t.y)) - d));
      e = max(e, abs(dep(vUv + vec2(-t.x,  t.y)) - d));
      e = max(e, abs(dep(vUv + vec2( t.x, -t.y)) - d));
      e = max(e, abs(dep(vUv + vec2(-t.x, -t.y)) - d));
      vEdge = e;

      // s > 0 表示比照片平面更远。沿相机射线缩放，保证原视角不变形
      float s = (uPivot - d) * uRange + uOffset;
      vec3 cam = vec3(0.0, 0.0, uD);
      vec3 p = vec3(position.xy, 0.0);
      vec3 q = cam + (p - cam) * (1.0 + s / uD);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
    }
  `;
}

export const depthDisplaceFragmentShader = /* glsl */ `
  uniform sampler2D uColor;
  uniform float uCut;       // 1 = 丢弃深度断层处的拉伸三角形
  uniform float uEdgeThr;
  uniform vec2 uRes;        // 画布像素尺寸
  varying vec2 vUv;
  varying float vEdge;

  void main() {
    if (uCut > 0.5 && vEdge > uEdgeThr) {
      // 正常情况下屏幕上 1 像素 ≈ 1/uRes.x 的 uv；
      // 被深度断层拉长的三角形，每像素的 uv 变化会小得多 → 才丢弃。
      // 这样默认视角（没有拉伸）下不会出现任何缺口 / 光晕。
      float r = length(fwidth(vUv)) * uRes.x / 1.41421;
      if (r < 0.65) discard;
    }
    // 贴图保持原始 sRGB 字节，不做色彩空间转换 → 与原照片颜色一致
    gl_FragColor = vec4(texture2D(uColor, vUv).rgb, 1.0);
  }
`;

/**
 * 创建 uniforms。color / depth 是已加载好的 THREE.Texture。
 * 会顺便把贴图配置成本着色器需要的样子（镜像延展、不转色彩空间、深度图不用 mipmap）。
 */
export function createDepthDisplaceUniforms({ color, depth, camDistance, range, pivot, offset, cut, edgeThr }) {
  color.colorSpace = THREE.NoColorSpace;
  color.wrapS = color.wrapT = THREE.MirroredRepeatWrapping;
  color.anisotropy = 8;
  color.needsUpdate = true;

  depth.colorSpace = THREE.NoColorSpace;
  depth.wrapS = depth.wrapT = THREE.MirroredRepeatWrapping;
  depth.generateMipmaps = false;
  depth.minFilter = THREE.LinearFilter;
  depth.needsUpdate = true;

  return {
    uColor: { value: color },
    uDepth: { value: depth },
    uTexel: { value: new THREE.Vector2(1 / depth.image.width, 1 / depth.image.height) },
    uRange: { value: range },
    uPivot: { value: pivot },
    uOffset: { value: offset },
    uD: { value: camDistance },
    uCut: { value: cut ? 1 : 0 },
    uEdgeThr: { value: edgeThr },
    uRes: { value: new THREE.Vector2(576, 1024) },
  };
}
