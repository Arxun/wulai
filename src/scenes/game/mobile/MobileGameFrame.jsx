import { useEffect, useRef, useState } from 'react';

const MIN = 0.85;
const MAX = 1.2;

/**
 * 移动端游戏视口：全屏铺满，双指捏合缩放（可选）。
 * 单指操作交给 Canvas（视角拖动）。
 */
export default function MobileGameFrame({ children, enabled = true }) {
  const root = useRef(null);
  const [pinchZoom, setPinchZoom] = useState(1);
  const pinchZoomRef = useRef(1);
  const pinch = useRef({ active: false, startDist: 0, startZoom: 1 });
  pinchZoomRef.current = pinchZoom;

  useEffect(() => {
    const el = root.current;
    if (!el || !enabled) return;

    const onStart = (e) => {
      if (e.touches.length !== 2) return;
      const [a, b] = e.touches;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      pinch.current = {
        active: true,
        startDist: Math.hypot(dx, dy) || 1,
        startZoom: pinchZoomRef.current,
      };
    };

    const onMove = (e) => {
      if (!pinch.current.active || e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = e.touches;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      const dist = Math.hypot(dx, dy) || 1;
      const next = pinch.current.startZoom * (dist / pinch.current.startDist);
      setPinchZoom(Math.min(MAX, Math.max(MIN, next)));
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

  const scale = enabled ? pinchZoom : 1;

  return (
    <div ref={root} className="mobile-game-frame">
      <div className="mobile-game-frame__inner" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
