import { useEffect, useState } from 'react';

/** 粗指针或窄屏视为移动端（游戏横屏布局） */
function detectMobile() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth <= 960;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return coarse || (narrow && ua) || (narrow && coarse);
}

/**
 * @returns {{ active: boolean }}
 */
export function useGameMobile() {
  const [active, setActive] = useState(() => detectMobile());

  useEffect(() => {
    const update = () => setActive(detectMobile());
    update();
    window.addEventListener('resize', update);
    const mq = window.matchMedia('(pointer: coarse)');
    mq.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      mq.removeEventListener?.('change', update);
    };
  }, []);

  return { active };
}
