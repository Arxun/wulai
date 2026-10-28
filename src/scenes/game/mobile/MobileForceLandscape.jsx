/**
 * 设备竖屏时把整个游戏区域旋转 90°，按横屏布局展示（不依赖系统转屏）。
 */
export default function MobileForceLandscape({ rotate = false, children }) {
  if (!rotate) return children;
  return (
    <div className="mobile-force-landscape" aria-hidden={false}>
      {children}
    </div>
  );
}
