/**
 * 武来模式控制台诊断：关键路径抛错时打日志，避免 useFrame 静默断帧。
 * 同类错误 2s 内合并计数，防止刷屏。
 */

const logState = new Map();

function shouldEmit(scope, message) {
  const now = Date.now();
  const prev = logState.get(scope);
  if (prev && prev.message === message && now - prev.at < 2000) {
    prev.count += 1;
    return false;
  }
  if (prev?.count > 1) {
    console.error(`[武来·${scope}] 上条同类错误重复 ${prev.count} 次`);
  }
  logState.set(scope, { at: now, message, count: 1 });
  return true;
}

/** @param {string} scope 模块名，如 hero/Player */
export function reportGameError(scope, err, detail) {
  const message = err?.message ?? String(err);
  if (!shouldEmit(scope, message)) return;
  console.error(`[武来·${scope}]`, err);
  if (detail !== undefined) console.error(`[武来·${scope}] detail:`, detail);
  if (err?.stack) console.error(err.stack);
}

/** 包一层 useFrame / 每帧逻辑，捕获后打 console，不 rethrow（尽量保住渲染循环） */
export function guardFrame(scope, fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch (err) {
      reportGameError(scope, err);
    }
  };
}

/** 挂载 window 与 WebGL 监听；返回卸载函数 */
export function attachWulaiErrorHandlers(gl) {
  const onError = (ev) => {
    reportGameError('window.error', ev.error ?? ev.message, {
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
    });
  };
  const onRejection = (ev) => {
    reportGameError('unhandledrejection', ev.reason);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  const canvas = gl?.domElement;
  const onLost = (ev) => {
    console.error('[武来·WebGL] context lost（画面可能卡死，需刷新）', ev);
  };
  const onRestored = () => {
    console.warn('[武来·WebGL] context restored');
  };
  canvas?.addEventListener('webglcontextlost', onLost);
  canvas?.addEventListener('webglcontextrestored', onRestored);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    canvas?.removeEventListener('webglcontextlost', onLost);
    canvas?.removeEventListener('webglcontextrestored', onRestored);
  };
}

/** 启动自检（vehicle / world 等是否因循环依赖未初始化） */
export function logWulaiBootChecks({ vehicle, world, combat }) {
  const tag = '[武来·init]';
  if (vehicle == null) {
    console.error(`${tag} vehicle 为 null/undefined，疑为 vehicles 循环依赖`);
  } else if (typeof vehicle.inCar !== 'boolean') {
    console.error(`${tag} vehicle.inCar 异常`, vehicle);
  } else {
    console.info(`${tag} vehicle OK`, { inCar: vehicle.inCar, id: vehicle.vehicleId });
  }
  if (world == null) console.error(`${tag} combat world 未就绪`);
  else if (typeof world.lock !== 'boolean') console.warn(`${tag} world.lock 类型异常`, world.lock);
  if (combat == null) console.error(`${tag} combat 未就绪`);
}
