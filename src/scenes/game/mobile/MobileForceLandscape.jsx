import { useLayoutEffect, useRef } from 'react';

/**
 * 竖屏持机时把游戏区旋转 90°，默认按横屏宽屏布局全屏展示（宽高对调，不做非等比缩放）。
 */
export default function MobileForceLandscape({ active = false, children }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    const sync = () => {
      const vv = window.visualViewport;
      const vw = Math.round(vv?.width ?? window.innerWidth);
      const vh = Math.round(vv?.height ?? window.innerHeight);
      el.style.width = `${vh}px`;
      el.style.height = `${vw}px`;
    };

    sync();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, [active]);

  if (!active) return children;

  return (
    <div ref={ref} className="mobile-force-landscape">
      {children}
    </div>
  );
}
