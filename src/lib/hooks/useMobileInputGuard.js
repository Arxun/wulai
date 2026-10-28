import { useEffect } from 'react';

/**
 * 移动端游戏：屏蔽长按菜单、选中、复制等浏览器/WebView 默认行为。
 */
export function useMobileInputGuard(enabled) {
  useEffect(() => {
    if (!enabled) return;

    const block = (e) => {
      e.preventDefault();
    };

    const opts = { capture: true, passive: false };
    document.addEventListener('contextmenu', block, opts);
    document.addEventListener('selectstart', block, opts);
    document.addEventListener('dragstart', block, opts);
    document.addEventListener('copy', block, opts);
    document.addEventListener('cut', block, opts);

    const html = document.documentElement;
    html.classList.add('mobile-touch-guard');
    return () => {
      document.removeEventListener('contextmenu', block, opts);
      document.removeEventListener('selectstart', block, opts);
      document.removeEventListener('dragstart', block, opts);
      document.removeEventListener('copy', block, opts);
      document.removeEventListener('cut', block, opts);
      html.classList.remove('mobile-touch-guard');
    };
  }, [enabled]);
}
