/** 悬浮在视口顶部正中，顺时针旋转整页 90° */
export default function MobileRotateFab({ onRotate }) {
  return (
    <button
      type="button"
      className="mobile-rotate-fab"
      aria-label="顺时针旋转屏幕"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRotate();
      }}
    >
      ↻ 旋转
    </button>
  );
}
