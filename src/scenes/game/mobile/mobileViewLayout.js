/** 按当前视口与旋转角计算根节点像素尺寸（与 WebGL 画布一致，避免 CSS 旋转后拉伸） */
export function readViewportPx() {
  if (typeof window === 'undefined') return { vw: 390, vh: 844 };
  const vv = window.visualViewport;
  return {
    vw: Math.round(vv?.width ?? window.innerWidth),
    vh: Math.round(vv?.height ?? window.innerHeight),
  };
}

/** 设备视口本身是否竖屏（与页面旋转角无关） */
export function isPortraitViewport() {
  const { vw, vh } = readViewportPx();
  return vh > vw;
}

/**
 * @param {number} rotationDeg 0 | 90 | 180 | 270 顺时针
 */
export function computeMobileViewLayout(rotationDeg = 0) {
  const { vw, vh } = readViewportPx();
  const swap = rotationDeg === 90 || rotationDeg === 270;
  const w = swap ? vh : vw;
  const h = swap ? vw : vh;
  let transform = 'none';
  if (swap) transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`;
  else if (rotationDeg) transform = `rotate(${rotationDeg}deg)`;

  return { vw, vh, w, h, swap, transform, rotationDeg };
}

/** 仅随旋转 remount；尺寸由 MobileCanvasResize + setSize 同步（避免地址栏 resize 反复重建 WebGL） */
export function mobileCanvasKey(rotationDeg, enabled) {
  if (!enabled) return 'normal';
  return `r${rotationDeg}`;
}
