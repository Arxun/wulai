import { useSyncExternalStore } from 'react';
import { getGameLoadingState, subscribeGameLoading } from './stores/gameLoadingStore';

/**
 * 武来进图遮罩：资源加载 + 淡出过渡（DOM，盖在 Canvas 上）
 */
export default function GameLoadingOverlay() {
  const { show, phase, progress, assetsActive, loaded, total } = useSyncExternalStore(
    subscribeGameLoading,
    getGameLoadingState,
  );

  if (!show && phase === 'hidden') return null;

  const leaving = phase === 'enter' || phase === 'hidden';
  const label = phase === 'enter' ? '进入黄山…' : '资源正在加载…';
  const sub =
    total > 0 && phase === 'loading'
      ? `(${loaded}/${total})`
      : assetsActive
        ? ''
        : '准备场景';

  return (
    <div className={`game-load${leaving ? ' game-load--leave' : ''}`} aria-live="polite" aria-busy={!leaving}>
      <div className="game-load__veil" />
      <div className="game-load__panel">
        <p className="game-load__brand">武来</p>
        <p className="game-load__text">
          {label}
          <span className="game-load__dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
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
