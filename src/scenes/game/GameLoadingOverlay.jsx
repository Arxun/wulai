import { useLayoutEffect, useSyncExternalStore } from 'react';
import {
  dismissGameLoadOverlay,
  getGameLoadingState,
  subscribeGameLoading,
} from './stores/gameLoadingStore';

/**
 * 武来进图遮罩：盖住首屏白底，主场景画出第一帧就关；不等 SU7。可点击跳过。
 */
export default function GameLoadingOverlay() {
  const { show, phase, progress, statusHint } = useSyncExternalStore(
    subscribeGameLoading,
    getGameLoadingState,
  );

  useLayoutEffect(() => {
    document.getElementById('boot-splash')?.remove();
  }, []);

  if (!show && phase === 'hidden') return null;

  const leaving = phase === 'enter' || phase === 'hidden';
  const label = phase === 'enter' ? '进入黄山…' : '正在加载场景…';
  const sub = statusHint || (phase === 'loading' ? '画面出来即可进入 · 点击跳过' : '');

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
        {phase === 'loading' && (
          <div className="game-load__bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="game-load__bar-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {sub ? <p className="game-load__sub">{sub}</p> : null}
      </div>
    </div>
  );
}
