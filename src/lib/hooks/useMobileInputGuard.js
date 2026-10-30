import { useEffect } from 'react';

/**
 * 按住不放的操控区（全部走 pointerdown）。这里取消 touchstart，浏览器就不会把长按交给系统
 * （小米识图 / 传送门、iOS 放大镜、文字选择）。用 onClick 的按钮不能放进来：取消 touchstart 后不会再有 click。
 */
const HOLD_ZONES = '.mobile-dpad, .mobile-combat-cluster, .mobile-right, .mobile-enter-center, canvas';

/**
 * 移动端游戏：屏蔽长按菜单、长按识图、选中、复制、浏览器双指缩放等默认行为。
 */
export function useMobileInputGuard(enabled) {
  useEffect(() => {
    if (!enabled) return;

    const block = (e) => {
      e.preventDefault();
    };

    /** 双指及以上阻止页面缩放（捏合由 MobileGameFrame → camDist）；按在操控区上阻止系统长按 */
    const blockMultiTouch = (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      if (e.type === 'touchstart' && e.target instanceof Element && e.target.closest(HOLD_ZONES)) {
        e.preventDefault();
      }
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
