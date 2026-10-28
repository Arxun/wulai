import { useCallback, useEffect, useRef } from 'react';
import { mobileKeys, setMobileKey } from './mobileInputStore';

const SECTORS = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

const ARROW_CODES = Object.values(SECTORS);

/** 相对圆心角度：0=上，顺时针为正；每方向占 90° */
function sectorAt(dx, dy, dead = 14) {
  if (Math.hypot(dx, dy) < dead) return null;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg >= -45 && deg < 45) return 'up';
  if (deg >= 45 && deg < 135) return 'right';
  if (deg >= 135 || deg < -135) return 'down';
  return 'left';
}

function syncArrowKeys(activeSectors) {
  for (const code of ARROW_CODES) mobileKeys.delete(code);
  for (const id of activeSectors) setMobileKey(SECTORS[id], true);
}

export default function MobileMovePad() {
  const discRef = useRef(null);
  /** @type {React.MutableRefObject<Map<number, string|null>>} */
  const pointers = useRef(new Map());

  const recompute = useCallback(() => {
    const set = new Set();
    for (const s of pointers.current.values()) {
      if (s) set.add(s);
    }
    syncArrowKeys(set);
  }, []);

  useEffect(
    () => () => {
      for (const code of ARROW_CODES) mobileKeys.delete(code);
    },
    [],
  );

  const localPoint = (e) => {
    const el = discRef.current;
    if (!el) return { dx: 0, dy: 0 };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return { dx: e.clientX - cx, dy: e.clientY - cy };
  };

  const bind = {
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const { dx, dy } = localPoint(e);
      pointers.current.set(e.pointerId, sectorAt(dx, dy));
      recompute();
    },
    onPointerMove: (e) => {
      if (!pointers.current.has(e.pointerId)) return;
      const { dx, dy } = localPoint(e);
      pointers.current.set(e.pointerId, sectorAt(dx, dy));
      recompute();
    },
    onPointerUp: (e) => {
      pointers.current.delete(e.pointerId);
      recompute();
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    },
    onPointerCancel: (e) => {
      pointers.current.delete(e.pointerId);
      recompute();
    },
  };

  return (
    <div className="mobile-dpad" aria-label="方向">
      <div className="mobile-dpad__ring" aria-hidden />
      <button
        type="button"
        ref={discRef}
        className="mobile-dpad__disc"
        aria-label="方向盘"
        {...bind}
      />
      <span className="mobile-dpad__hint mobile-dpad__hint--up" aria-hidden>
        ↑
      </span>
      <span className="mobile-dpad__hint mobile-dpad__hint--down" aria-hidden>
        ↓
      </span>
      <span className="mobile-dpad__hint mobile-dpad__hint--left" aria-hidden>
        ←
      </span>
      <span className="mobile-dpad__hint mobile-dpad__hint--right" aria-hidden>
        →
      </span>
    </div>
  );
}
