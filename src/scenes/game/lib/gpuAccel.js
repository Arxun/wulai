/**
 * 探测本机 WebGL / 合成层能力；能开则请求高性能 GPU，并给 DOM 大招层加 compositor 提示。
 * 3D 大招本身已在 WebGL 里跑 GPU，这里主要减少「标题 / 全屏闪」与 context 选错核显的问题。
 */

let cached = null;
/** @type {Promise<{ supported: boolean, reason?: string, description?: string, vendor?: string, device?: string }> | null} */
let webgpuProbe = null;

function readRenderer(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (!ext) return { renderer: '', vendor: '' };
  return {
    renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '',
    vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '',
  };
}

function looksSoftware(renderer) {
  return /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(renderer || '');
}

/**
 * @returns {{
 *   available: boolean,
 *   preferHighPerformance: boolean,
 *   software: boolean,
 *   domCompositor: boolean,
 *   webgl2: boolean,
 *   renderer: string,
 *   vendor: string,
 *   reason?: string,
 * }}
 */
export function probeWebGLGpu() {
  if (cached) return cached;
  if (typeof document === 'undefined') {
    cached = {
      available: false,
      preferHighPerformance: false,
      software: true,
      domCompositor: false,
      webgl2: false,
      renderer: '',
      vendor: '',
      reason: 'no-document',
    };
    return cached;
  }

  const canvas = document.createElement('canvas');
  const attrs = { powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false, alpha: false };
  const gl2 = canvas.getContext('webgl2', attrs);
  const gl = gl2 || canvas.getContext('webgl', attrs);

  if (!gl) {
    cached = {
      available: false,
      preferHighPerformance: false,
      software: true,
      domCompositor: false,
      webgl2: false,
      renderer: '',
      vendor: '',
      reason: 'no-webgl',
    };
    return cached;
  }

  const { renderer, vendor } = readRenderer(gl);
  const software = looksSoftware(renderer);
  const domCompositor = typeof CSS !== 'undefined' && CSS.supports('will-change', 'transform');

  cached = {
    available: true,
    preferHighPerformance: !software,
    software,
    domCompositor,
    webgl2: !!gl2,
    renderer,
    vendor,
  };

  const lose = gl.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();

  return cached;
}

/** 浏览器 WebGPU（与 Three 的 WebGPURenderer 不是同一层，但无 adapter 则 Three 也只能走 WebGL 回退） */
export function probeWebGPU() {
  if (webgpuProbe) return webgpuProbe;
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    webgpuProbe = Promise.resolve({ supported: false, reason: 'navigator.gpu 不可用' });
    return webgpuProbe;
  }
  webgpuProbe = (async () => {
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { supported: false, reason: 'requestAdapter 无结果' };
      const info = adapter.info ?? {};
      return {
        supported: true,
        description: info.description || '',
        vendor: info.vendor || '',
        device: info.device || '',
      };
    } catch (err) {
      return { supported: false, reason: err?.message || String(err) };
    }
  })();
  return webgpuProbe;
}

/**
 * 武来能否切到 `THREE.WebGPURenderer`（仅评估，当前工程仍用 WebGLRenderer + R3F）。
 * @returns {Promise<{ ok: boolean, reasons: string[] }>}
 */
export async function assessWebGPURendererForWulai() {
  const reasons = [];
  const webgpu = await probeWebGPU();
  if (!webgpu.supported) reasons.push(`WebGPU: ${webgpu.reason || '不支持'}`);

  reasons.push('R3F Canvas 默认 WebGLRenderer；WebGPURenderer 需 async init()，与现有 gl 回调不直接等价');
  reasons.push('drei：Environment / useGLTF(Draco) / Html / 阴影等与 WebGL 路径绑定');
  reasons.push('postprocessing 包依赖 WebGL 帧缓冲，未对接 three/webgpu PostProcessing');

  return { browserWebGPU: webgpu.supported, projectReady: false, reasons };
}

/** 在 <html> 上标记 gpu-accel / gpu-software，供 CSS 与调试 */
export function applyGpuAccelDomClass() {
  const p = probeWebGLGpu();
  const root = document.documentElement;
  const accel = p.available && p.preferHighPerformance && p.domCompositor;
  root.classList.toggle('gpu-accel', accel);
  root.classList.toggle('gpu-software', p.software);
  if (import.meta.env.DEV) {
    console.info('[武来·GPU·WebGL]', {
      accel,
      preferHighPerformance: p.preferHighPerformance,
      webgl2: p.webgl2,
      renderer: p.renderer || '(unknown)',
    });
    void probeWebGPU().then((w) => {
      console.info('[武来·GPU·WebGPU]', w);
      void assessWebGPURendererForWulai().then(({ browserWebGPU, projectReady, reasons }) => {
        console.info('[武来·WebGPURenderer 评估]', {
          browserWebGPU,
          projectReady,
          hint: browserWebGPU
            ? '本机可跑 three/webgpu 演示，武来主场景仍应用 WebGL2（已在 GPU 上）'
            : '浏览器无 WebGPU，Three 会自动 WebGL2 回退',
          reasons,
        });
      });
    });
  }
  return p;
}

/** 合并 R3F Canvas `gl` 选项 */
export function buildCanvasGlOptions(base = {}) {
  const p = probeWebGLGpu();
  return {
    failIfMajorPerformanceCaveat: false,
    ...base,
    ...(p.preferHighPerformance ? { powerPreference: 'high-performance' } : {}),
  };
}

export function getGpuProbeSnapshot() {
  return probeWebGLGpu();
}
