/** 竖屏时提示横屏游玩 */
export default function MobileRotatePrompt() {
  return (
    <div className="mobile-rotate" role="dialog" aria-label="请横屏">
      <div className="mobile-rotate__icon" aria-hidden>
        📱↻
      </div>
      <p className="mobile-rotate__title">请旋转设备</p>
      <p className="mobile-rotate__sub">横屏体验更佳</p>
    </div>
  );
}
