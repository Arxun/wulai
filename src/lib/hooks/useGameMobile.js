import { useEffect, useState } from 'react';

/** 粗指针或窄屏视为移动端（游戏横屏布局） */
function detectMobile() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth <= 960;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return coarse || (narrow && ua) || (narrow && coarse);
}

function detectLandscape() {
  if (typeof window === 'undefined') return true;
  return window.innerWidth > window.innerHeight;
}

/**
 * @returns {{ active: boolean, landscape: boolean }}
 */
export function useGameMobile() {
  const [state, setState] = useState(() => ({
    active: detectMobile(),
    landscape: detectLandscape(),
  }));

  useEffect(() => {
    const update = () => {
      setState({ active: detectMobile(), landscape: detectLandscape() });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const mq = window.matchMedia('(pointer: coarse)');
    mq.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      mq.removeEventListener?.('change', update);
    };
  }, []);

  useEffect(() => {
    if (!state.active || !state.landscape) return;
    const ori = screen.orientation;
    if (!ori?.lock) return;
    ori.lock('landscape').catch(() => {});
    return () => {
      // unlock() 在部分浏览器返回 void，不能链式 .catch
      try {
        const r = ori.unlock?.();
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch (_) {
        /* ignore */
      }
    };
  }, [state.active, state.landscape]);

  return state;
}
