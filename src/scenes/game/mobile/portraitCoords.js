/**
 * 竖屏宽屏根节点 transform: rotate(90deg) 后，把触点从屏幕坐标还原到根节点本地坐标（Y 向下）。
 * 与 CSS rotate(90deg) 互逆：localX = -sy, localY = sx（相对根节点中心）。
 */
export function clientToWideRootLocal(root, clientX, clientY) {
  const rr = root.getBoundingClientRect();
  const rcx = rr.left + rr.width / 2;
  const rcy = rr.top + rr.height / 2;
  const sx = clientX - rcx;
  const sy = clientY - rcy;
  return { localX: -sy, localY: sx };
}

/** 相对某元素圆心的 dx/dy（宽屏根节点 rotate 后的本地坐标） */
export function discDeltaFromClient(root, disc, clientX, clientY) {
  const touch = clientToWideRootLocal(root, clientX, clientY);
  const r = disc.getBoundingClientRect();
  const center = clientToWideRootLocal(root, r.left + r.width / 2, r.top + r.height / 2);
  return { dx: touch.localX - center.localX, dy: touch.localY - center.localY };
}
