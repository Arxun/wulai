/** 武来进图加载态（DOM  overlay，与 Canvas 内 useProgress 同步） */

import { GAME_PERF } from '../config/perf';

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
  /** 资源已 100%（与 assetsActive 配合） */
  assetsReady: false,
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

function emit() {
  listeners.forEach((fn) => fn());
}

function clearTimers() {
  if (finishTimer) clearTimeout(finishTimer);
  if (hideTimer) clearTimeout(hideTimer);
  if (warmupFallbackTimer) clearTimeout(warmupFallbackTimer);
  finishTimer = null;
  hideTimer = null;
  warmupFallbackTimer = null;
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
    warmupDone: false,
    statusHint: '',
  };
  emit();
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
    warmupDone: false,
    statusHint: '',
  };
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
  if (!active && progress >= 100) {
    const skipWarmupGate = !GAME_PERF.gateLoadingOnSkillWarmup;
    state = {
      ...state,
      assetsReady: true,
      ...(skipWarmupGate ? { warmupDone: true, statusHint: '' } : {}),
    };
    emit();
    if (GAME_PERF.gateLoadingOnSkillWarmup) armWarmupFallback();
    tryScheduleFinish();
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
  if (!state.assetsReady) return;
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
