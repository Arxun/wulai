import { useState } from 'react';

/** 竖屏时遮罩 + 居中按钮，引导用户物理横屏（不 CSS 旋转、不拉伸画面） */
export default function MobileLandscapeGate() {
  const [hint, setHint] = useState('');

  const requestLandscape = async () => {
    setHint('');
    try {
      const ori = screen.orientation;
      if (ori?.lock) {
        await ori.lock('landscape');
        setHint('已锁定横屏，请旋转设备');
        return;
      }
    } catch {
      /* 多数浏览器需全屏或用户手势，失败则提示手动转 */
    }
    setHint('请将手机旋转至横屏继续');
  };

  return (
    <div className="mobile-landscape-gate" role="dialog" aria-label="请横屏游玩">
      <div className="mobile-landscape-gate__card">
        <div className="mobile-landscape-gate__icon" aria-hidden>
          📱
        </div>
        <p className="mobile-landscape-gate__title">横屏游玩</p>
        <p className="mobile-landscape-gate__sub">画面不旋转、不拉伸，请使用设备横屏</p>
        <button type="button" className="mobile-landscape-gate__btn" onPointerDown={requestLandscape}>
          切换横屏
        </button>
        {hint ? <p className="mobile-landscape-gate__hint">{hint}</p> : null}
      </div>
    </div>
  );
}
