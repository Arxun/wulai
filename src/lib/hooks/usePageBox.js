import { useLayoutEffect, useState } from 'react';
import { readViewportPx } from '../../scenes/game/mobile/mobileViewLayout';

/**
 * 页面根容器（position: fixed; inset: 0）的实测宽高。
 * 用 ResizeObserver 而不是 resize / orientationchange：iOS 旋转时这些事件先到、尺寸后变，读到的是旧值。
 * @param {React.RefObject<HTMLElement>} ref
 * @param {boolean} enabled
 */
export function usePageBox(ref, enabled) {
  const [box, setBox] = useState(readViewportPx);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const apply = () => {
      const vw = Math.round(el.clientWidth);
      const vh = Math.round(el.clientHeight);
      if (vw < 1 || vh < 1) return;
      setBox((prev) => (prev.vw === vw && prev.vh === vh ? prev : { vw, vh }));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, enabled]);

  return box;
}
