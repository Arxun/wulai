import { useEffect } from 'react';
import { clearMobileKeys, setMobileKey } from './mobileInputStore';

const PAD = [
  { id: 'up', code: 'ArrowUp', label: '↑', pos: 'up' },
  { id: 'left', code: 'ArrowLeft', label: '←', pos: 'left' },
  { id: 'right', code: 'ArrowRight', label: '→', pos: 'right' },
  { id: 'down', code: 'ArrowDown', label: '↓', pos: 'down' },
];

export default function MobileMovePad() {
  useEffect(() => () => clearMobileKeys(), []);

  const bind = (code) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setMobileKey(code, true);
    },
    onPointerUp: (e) => {
      setMobileKey(code, false);
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    },
    onPointerCancel: () => setMobileKey(code, false),
    onPointerLeave: (e) => {
      if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) setMobileKey(code, false);
    },
  });

  return (
    <div className="mobile-dpad" aria-label="方向">
      <div className="mobile-dpad__ring" aria-hidden />
      {PAD.map((b) => (
        <button
          key={b.id}
          type="button"
          className={`mobile-dpad__btn mobile-dpad__btn--${b.pos}`}
          aria-label={b.id}
          {...bind(b.code)}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
