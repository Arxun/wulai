import { useEffect, useRef } from 'react';
import { mobileView, setMobileCamDistMult } from './mobileViewStore';

/**
 * 移动端游戏容器：双指捏合调节第三人称相机远近（与 PC 滚轮一致，不缩放 DOM）。
 */
export default function MobileGameFrame({ children, enabled = true }) {
  const root = useRef(null);
  const pinch = useRef({ active: false, startDist: 0, startMult: 1 });

  useEffect(() => {
    const el = root.current;
    if (!el || !enabled) return;

    const dist = (touches) => {
      const [a, b] = touches;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
    };

    const onStart = (e) => {
      if (e.touches.length !== 2) return;
      pinch.current = {
        active: true,
        startDist: dist(e.touches),
        startMult: mobileView.camDistMult,
      };
    };

    const onMove = (e) => {
      if (!pinch.current.active || e.touches.length !== 2) return;
      e.preventDefault();
      const ratio = dist(e.touches) / pinch.current.startDist;
      setMobileCamDistMult(pinch.current.startMult * ratio);
    };

    const onEnd = () => {
      pinch.current.active = false;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  return (
    <div ref={root} className="mobile-game-frame">
      {children}
    </div>
  );
}
