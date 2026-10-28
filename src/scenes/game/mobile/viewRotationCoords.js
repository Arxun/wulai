/**
 * 把屏幕触点映射到旋转根节点本地坐标（CSS rotate 顺时针 viewRotationDeg）。
 */
export function clientToRootLocal(root, clientX, clientY, viewRotationDeg) {
  const rr = root.getBoundingClientRect();
  const rcx = rr.left + rr.width / 2;
  const rcy = rr.top + rr.height / 2;
  const sx = clientX - rcx;
  const sy = clientY - rcy;
  const rad = (-viewRotationDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    localX: sx * c - sy * s,
    localY: sx * s + sy * c,
  };
}

export function discDeltaFromClient(root, disc, clientX, clientY, viewRotationDeg) {
  const touch = clientToRootLocal(root, clientX, clientY, viewRotationDeg);
  const r = disc.getBoundingClientRect();
  const center = clientToRootLocal(root, r.left + r.width / 2, r.top + r.height / 2, viewRotationDeg);
  return { dx: touch.localX - center.localX, dy: touch.localY - center.localY };
}

/** 指针位移（屏幕空间）转到未旋转的相机拖动手势 */
export function pointerDeltaForView(movementX, movementY, viewRotationDeg) {
  if (!viewRotationDeg) return { dx: movementX, dy: movementY };
  const rad = (-viewRotationDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    dx: movementX * c - movementY * s,
    dy: movementX * s + movementY * c,
  };
}
