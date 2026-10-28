import { useLayoutEffect, useRef } from 'react';
import { mobileLayout } from './mobileLayoutStore';

/**
 * 整页旋转；宽高在 render 时已按视口算好，Canvas 与容器同尺寸，仅 CSS rotate。
 */
export default function MobileViewRotator({ enabled = false, layout = null, children }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (!enabled || !layout) {
      mobileLayout.viewRotation = 0;
      mobileLayout.swapViewport = false;
      mobileLayout.wideW = 0;
      mobileLayout.wideH = 0;
      return;
    }
    mobileLayout.viewRotation = layout.rotationDeg;
    mobileLayout.swapViewport = layout.swap;
    mobileLayout.wideW = layout.w;
    mobileLayout.wideH = layout.h;
  }, [enabled, layout]);

  if (!enabled || !layout) return children;

  return (
    <div
      ref={ref}
      className={`mobile-view-rotator${layout.swap ? ' mobile-view-rotator--swap' : ''}`}
      data-rotation={layout.rotationDeg}
      style={{
        width: layout.w,
        height: layout.h,
        transform: layout.transform,
      }}
    >
      {children}
    </div>
  );
}
