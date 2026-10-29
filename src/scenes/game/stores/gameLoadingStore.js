/** 武来进图加载态（DOM  overlay，与 Canvas 内 useProgress 同步） */

import { GAME_PERF } from '../config/perf';

/** 遮罩最短展示（不阻塞玩，只防闪一下） */
const MIN_VISIBLE_MS = 180;
const ENTER_HOLD_MS = 160;
/** 不等待 Canvas/资源，到点即关遮罩 */
const FAST_DISMISS_MS = 320;

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
  /** 资源已 100%（后台，不挡进图） */
  assetsReady: false,
  /** 人/地/怪等核心可玩 */
  criticalReady: false,
  /** 技能着色器预热完成（SkillFxWarmup 上报） */
  warmupDone: false,
  /** 遮罩副文案：预热中等 */
  statusHint: '',
};

const listeners = new Set();
let startedAt = 0;
let finishTimer = null;
let hideTimer = null;
let warmupFallbackTimer = null;
let criticalFallbackTimer = null;
let fastDismissTimer = null;

const CRITICAL_FALLBACK_MS = 2800;

function emit() {
  listeners.forEach((fn) => fn());
}

function clearTimers() {
  if (finishTimer) clearTimeout(finishTimer);
  if (hideTimer) clearTimeout(hideTimer);
  if (warmupFallbackTimer) clearTimeout(warmupFallbackTimer);
  if (criticalFallbackTimer) clearTimeout(criticalFallbackTimer);
  if (fastDismissTimer) clearTimeout(fastDismissTimer);
  finishTimer = null;
  hideTimer = null;
  warmupFallbackTimer = null;
  criticalFallbackTimer = null;
  fastDismissTimer = null;
}

function armFastDismiss() {
  if (fastDismissTimer) return;
  fastDismissTimer = setTimeout(() => {
    fastDismissTimer = null;
    markGameLoadCriticalReady();
  }, FAST_DISMISS_MS);
}

function armCriticalFallback() {
  if (criticalFallbackTimer) return;
  criticalFallbackTimer = setTimeout(() => {
    criticalFallbackTimer = null;
    markGameLoadCriticalReady();
  }, CRITICAL_FALLBACK_MS);
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
    assetsReady: false,
    criticalReady: false,
    warmupDone: true,
    statusHint: '',
  };
  armCriticalFallback();
  armFastDismiss();
  emit();
}

/** 用户点遮罩或等不及时立即进图 */
export function dismissGameLoadOverlay() {
  if (state.phase !== 'loading' || !state.show) return;
  markGameLoadCriticalReady();
}

/** 离开武来或强制结束 */
export function resetGameLoad() {
  clearTimers();
  state = {
    ...state,
    show: false,
    phase: 'hidden',
    assetsActive: false,
    assetsReady: false,
    criticalReady: false,
    warmupDone: false,
    statusHint: '',
  };
  emit();
}

/** 核心场景就绪（GameCriticalReady）— 允许关遮罩进图 */
export function markGameLoadCriticalReady() {
  if (state.criticalReady) return;
  state = {
    ...state,
    criticalReady: true,
    warmupDone: true,
    statusHint: '',
  };
  emit();
  tryScheduleFinish();
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
  if (!active && progress >= 100) {
    state = { ...state, assetsReady: true };
    emit();
    if (GAME_PERF.gateLoadingOnSkillWarmup) armWarmupFallback();
  }
}

/** SkillFxWarmup 开始 */
export function markGameLoadWarmupStarted() {
  if (!state.show || state.phase !== 'loading') return;
  state = { ...state, statusHint: '预热战斗特效…' };
  emit();
}

/** SkillFxWarmup 结束（成功或放弃） */
export function completeGameLoadWarmup() {
  if (state.warmupDone) return;
  state = { ...state, warmupDone: true, statusHint: '' };
  emit();
  tryScheduleFinish();
}

function armWarmupFallback() {
  if (warmupFallbackTimer) return;
  warmupFallbackTimer = setTimeout(() => {
    warmupFallbackTimer = null;
    if (!state.warmupDone && state.show && state.phase === 'loading') {
      state = { ...state, warmupDone: true, statusHint: '' };
      emit();
      tryScheduleFinish();
    }
  }, GAME_PERF.skillWarmupTimeoutMs);
}

function tryScheduleFinish() {
  if (state.phase !== 'loading') return;
  if (!state.criticalReady) return;
  if (GAME_PERF.gateLoadingOnSkillWarmup && !state.warmupDone) return;
  scheduleFinish();
}

function scheduleFinish() {
  if (state.phase !== 'loading') return;
  const elapsed = Date.now() - startedAt;
  const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
  clearTimers();
  finishTimer = setTimeout(() => {
    state = { ...state, phase: 'enter', progress: 100, statusHint: '' };
    emit();
    hideTimer = setTimeout(() => {
      state = { ...state, phase: 'hidden', show: false };
      emit();
    }, ENTER_HOLD_MS);
  }, delay);
}
