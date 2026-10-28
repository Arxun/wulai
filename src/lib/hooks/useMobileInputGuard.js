import { useEffect } from 'react';

/**
 * 移动端游戏：屏蔽长按菜单、选中、复制、浏览器双指缩放等默认行为。
 */
export function useMobileInputGuard(enabled) {
  useEffect(() => {
    if (!enabled) return;

    const block = (e) => {
      e.preventDefault();
    };

    /** 双指及以上：阻止浏览器页面缩放；游戏区捏合由 MobileGameFrame → camDist */
    const blockMultiTouch = (e) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    const opts = { capture: true, passive: false };
    document.addEventListener('contextmenu', block, opts);
    document.addEventListener('selectstart', block, opts);
    document.addEventListener('dragstart', block, opts);
    document.addEventListener('copy', block, opts);
    document.addEventListener('cut', block, opts);
    document.addEventListener('touchstart', blockMultiTouch, opts);
    document.addEventListener('touchmove', blockMultiTouch, opts);
    document.addEventListener('gesturestart', block, opts);
    document.addEventListener('gesturechange', block, opts);
    document.addEventListener('gestureend', block, opts);

    const html = document.documentElement;
    html.classList.add('mobile-touch-guard');
    return () => {
      document.removeEventListener('contextmenu', block, opts);
      document.removeEventListener('selectstart', block, opts);
      document.removeEventListener('dragstart', block, opts);
      document.removeEventListener('copy', block, opts);
      document.removeEventListener('cut', block, opts);
      document.removeEventListener('touchstart', blockMultiTouch, opts);
      document.removeEventListener('touchmove', blockMultiTouch, opts);
      document.removeEventListener('gesturestart', block, opts);
      document.removeEventListener('gesturechange', block, opts);
      document.removeEventListener('gestureend', block, opts);
      html.classList.remove('mobile-touch-guard');
    };
  }, [enabled]);
}
