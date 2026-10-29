import { useSyncExternalStore } from 'react';
import {
  dismissGameLoadOverlay,
  getGameLoadingState,
  subscribeGameLoading,
} from './stores/gameLoadingStore';

/**
 * 武来进图遮罩：短展示、可点击跳过；不等 SU7/全资源。
 */
export default function GameLoadingOverlay() {
  const { show, phase, progress, total, statusHint } = useSyncExternalStore(
    subscribeGameLoading,
    getGameLoadingState,
  );

  if (!show && phase === 'hidden') return null;

  const leaving = phase === 'enter' || phase === 'hidden';
  const label = phase === 'enter' ? '进入黄山…' : '正在启动…';
  const sub =
    statusHint ||
    (total > 0 && phase === 'loading' ? `后台资源 (${progress}%)` : phase === 'loading' ? '点击屏幕进入' : '');

  return (
    <div
      className={`game-load${leaving ? ' game-load--leave' : ''}`}
      aria-live="polite"
      aria-busy={!leaving}
      role={phase === 'loading' ? 'button' : undefined}
      tabIndex={phase === 'loading' ? 0 : undefined}
      onClick={phase === 'loading' ? dismissGameLoadOverlay : undefined}
      onKeyDown={(e) => {
        if (phase === 'loading' && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          dismissGameLoadOverlay();
        }
      }}
    >
      <div className="game-load__veil" />
      <div className="game-load__panel">
        <p className="game-load__brand">武来</p>
        <p className="game-load__text">
          {label}
          {!leaving && (
            <span className="game-load__dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          )}
        </p>
        {phase === 'loading' && total > 0 && (
          <div className="game-load__bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="game-load__bar-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {sub ? <p className="game-load__sub">{sub}</p> : null}
      </div>
    </div>
  );
}
