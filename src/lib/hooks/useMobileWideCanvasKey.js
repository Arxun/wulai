import { useLayoutEffect, useState } from 'react';
import { mobileLayout } from '../../scenes/game/mobile/mobileLayoutStore';

function readWideSize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv?.width ?? window.innerWidth);
  const vh = Math.round(vv?.height ?? window.innerHeight);
  return { w: vh, h: vw };
}

/** 竖屏宽屏时按对调后的视口尺寸生成 Canvas key，避免错误宽高比渲染 */
export function useMobileWideCanvasKey(portraitWide) {
  const [key, setKey] = useState('normal');

  useLayoutEffect(() => {
    if (!portraitWide) {
      mobileLayout.wideW = 0;
      mobileLayout.wideH = 0;
      setKey('normal');
      return;
    }
    const sync = () => {
      const { w, h } = readWideSize();
      mobileLayout.wideW = w;
      mobileLayout.wideH = h;
      setKey(`wide-${w}x${h}`);
    };
    sync();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      vv?.removeEventListener('resize', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, [portraitWide]);

  return key;
}
