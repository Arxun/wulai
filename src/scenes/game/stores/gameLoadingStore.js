/** 武来进图加载态（DOM  overlay，与 Canvas 内 useProgress 同步） */

const MIN_VISIBLE_MS = 720;
const ENTER_HOLD_MS = 420;

let state = {
  /** 是否显示遮罩（由 App 在进入 game 模式时打开） */
  show: false,
  /** drei 是否仍在拉资源 */
  assetsActive: true,
  progress: 0,
  loaded: 0,
  total: 0,
  /** loading | enter | hidden */
  phase: 'hidden',
};

const listeners = new Set();
let startedAt = 0;
let finishTimer = null;
let hideTimer = null;

function emit() {
  listeners.forEach((fn) => fn());
}

function clearTimers() {
  if (finishTimer) clearTimeout(finishTimer);
  if (hideTimer) clearTimeout(hideTimer);
  finishTimer = null;
  hideTimer = null;
}

export function getGameLoadingState() {
  return state;
}

export function subscribeGameLoading(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 进入武来模式 */
export function beginGameLoad() {
  clearTimers();
  startedAt = Date.now();
  state = {
    show: true,
    assetsActive: true,
    progress: 0,
    loaded: 0,
    total: 0,
    phase: 'loading',
  };
  emit();
}

/** 离开武来或强制结束 */
export function resetGameLoad() {
  clearTimers();
  state = { ...state, show: false, phase: 'hidden', assetsActive: false };
  emit();
}

/** Canvas 内上报 useProgress */
export function updateGameLoadAssets({ active, progress, loaded, total }) {
  if (!state.show || state.phase === 'hidden') return;
  state = {
    ...state,
    assetsActive: active,
    progress: Math.min(100, Math.round(progress)),
    loaded,
    total,
  };
  emit();
  if (!active && progress >= 100) scheduleFinish();
}

function scheduleFinish() {
  if (state.phase !== 'loading') return;
  const elapsed = Date.now() - startedAt;
  const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
  clearTimers();
  finishTimer = setTimeout(() => {
    state = { ...state, phase: 'enter', progress: 100 };
    emit();
    hideTimer = setTimeout(() => {
      state = { ...state, phase: 'hidden', show: false };
      emit();
    }, ENTER_HOLD_MS);
  }, delay);
}
