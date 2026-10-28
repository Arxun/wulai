import { useLayoutEffect, useRef, useState } from 'react';
import { mobileLayout } from './mobileLayoutStore';

function readWideSize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv?.width ?? window.innerWidth);
  const vh = Math.round(vv?.height ?? window.innerHeight);
  return { w: vh, h: vw };
}

/**
 * 竖屏（微信等）时在根节点把 Canvas + HUD 一起 rotate(90deg) 当宽屏。
 * 先算好对调后的像素宽高再挂载子树，避免 Canvas 按竖屏比例渲染后被拉伸。
 */
export default function MobileForceLandscape({ active = false, children }) {
  const ref = useRef(null);
  const [wide, setWide] = useState(() => (active ? readWideSize() : null));

  useLayoutEffect(() => {
    if (!active) {
      mobileLayout.portraitWide = false;
      setWide(null);
      return;
    }

    mobileLayout.portraitWide = true;
    const sync = () => {
      const next = readWideSize();
      mobileLayout.wideW = next.w;
      mobileLayout.wideH = next.h;
      setWide(next);
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
      mobileLayout.portraitWide = false;
    };
  }, [active]);

  if (!active) return children;

  if (!wide) {
    return <div className="mobile-portrait-wide-root mobile-portrait-wide-root--pending" aria-hidden />;
  }

  return (
    <div
      ref={ref}
      className="mobile-portrait-wide-root"
      style={{ width: wide.w, height: wide.h }}
      data-wide-w={wide.w}
      data-wide-h={wide.h}
    >
      {children}
    </div>
  );
}
