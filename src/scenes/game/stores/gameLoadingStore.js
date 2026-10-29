/** 武来进图加载态（DOM  overlay，与 Canvas 内 useProgress 同步） */

import { GAME_PERF } from '../config/perf';

/** 遮罩最短展示（不阻塞玩，只防闪一下）。画面出来之后只短暂停一下再揭开 */
const MIN_VISIBLE_MS = 180;
const ENTER_HOLD_MS = 80;

/** 首屏阶段进度：只涨不降，不等 SU7 */
const BOOT_PROGRESS = { boot: 8, chunk: 46, canvas: 72 };

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

/** 第一帧一直不来时的兜底，避免遮罩卡死；正常路径是画面出来就关 */
const CRITICAL_FALLBACK_MS = 8000;

function paintBootSplash() {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('boot-splash');
  if (!root) return;
  if (!state.show || state.phase === 'hidden') {
    root.remove();
    return;
  }
  const fill = root.querySelector('[data-fill]');
  const text = root.querySelector('[data-text]');
  if (fill) fill.style.width = `${state.progress}%`;
  if (text) text.textContent = state.phase === 'enter' ? '进入黄山…' : '正在加载场景…';
}

function emit() {
  paintBootSplash();
  listeners.forEach((fn) => fn());
}

function clearTimers() {
  if (finishTimer) clearTimeout(finishTimer);
  if (hideTimer) clearTimeout(hideTimer);
  if (warmupFallbackTimer) clearTimeout(warmupFallbackTimer);
  if (criticalFallbackTimer) clearTimeout(criticalFallbackTimer);
  finishTimer = null;
  hideTimer = null;
  warmupFallbackTimer = null;
  criticalFallbackTimer = null;
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
    progress: BOOT_PROGRESS.boot,
    loaded: 0,
    total: 0,
    phase: 'loading',
    assetsReady: false,
    criticalReady: false,
    warmupDone: true,
    statusHint: '',
  };
  armCriticalFallback();
  emit();
}

/** 首屏阶段：脚本块 / 画布挂上。只涨不降，不代替「第一帧出来再进游戏」。 */
export function noteGameLoadStage(stage) {
  const next = BOOT_PROGRESS[stage];
  if (!next || !state.show || state.phase !== 'loading' || state.progress >= next) return;
  state = { ...state, progress: next };
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
    progress: 100,
  };
  emit();
  tryScheduleFinish();
}

/** Canvas 内上报 useProgress */
export function updateGameLoadAssets({ active, progress, loaded, total }) {
  if (!state.show || state.phase === 'hidden') return;
  const reported = Math.min(100, Math.round(progress));
  state = {
    ...state,
    assetsActive: active,
    // 没有在拉的资源时保留首屏阶段进度，避免被 0 盖掉
    progress: total > 0 ? Math.max(state.progress, reported) : state.progress,
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
