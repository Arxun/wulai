import { useEffect, useRef } from 'react';
import { moveProgress } from '../../lib/animation/combatMoves';
import { world } from './combatStore';

/**
 * 大招开场标题：两个中文大字「武来」。
 * 0~0.4s 从远处冲到画面中央一小块 → 闪白掠过。字要能看清，不能铺满屏幕。
 */

const FONT = '"Kaiti SC", "STKaiti", "KaiTi", "STXingkai", "华文行楷", "Songti SC", "PingFang SC", serif';

export default function WulaiTitle() {
  const root = useRef();
  const wu = useRef();
  const lai = useRef();
  const flash = useRef();
  const bits = useRef();

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const on = world.move === 'wulai';
      const sec = on ? moveProgress(world) * 3 : 99;
      const show = on && sec < 0.4;
      const el = root.current;
      if (el) el.style.display = show ? 'flex' : 'none';
      if (show) {
        const u = sec / 0.4;
        let scale;
        let x = 0;
        let rot = 0;
        let op = 1;
        if (u < 0.5) {
          const k = u / 0.5;
          scale = 0.45 + k * k * 0.7;
          op = 0.4 + k * 0.6;
        } else if (u < 0.78) {
          scale = 1.15;
          op = 1;
        } else {
          const k = (u - 0.78) / 0.22;
          scale = 1.15 + k * 0.2;
          x = k * 18;
          rot = -6 * k;
          op = 1 - k;
        }
        if (wu.current) {
          wu.current.style.transform = `translate(${-x * 0.4}vw, 0) scale(${scale}) rotate(${rot}deg)`;
          wu.current.style.opacity = String(op);
        }
        if (lai.current) {
          lai.current.style.transform = `translate(${x * 0.35}vw, 0) scale(${scale}) rotate(${-rot}deg)`;
          lai.current.style.opacity = String(op);
        }
        if (flash.current) {
          const f = u > 0.55 && u < 0.8 ? Math.sin(((u - 0.55) / 0.25) * Math.PI) : 0;
          flash.current.style.opacity = String(f * 0.92);
        }
        if (bits.current) {
          bits.current.style.opacity = String(u < 0.75 ? 0.9 : (1 - u) * 3);
          bits.current.style.transform = `scale(${1 + u * 1.4})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={root} className="wulai-title" style={{ display: 'none' }} aria-hidden>
      <div ref={flash} className="wulai-flash" />
      <div ref={bits} className="wulai-bits">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ '--i': i }} />
        ))}
      </div>
      <b ref={wu} className="wulai-glyph" style={{ fontFamily: FONT }}>
        武
      </b>
      <b ref={lai} className="wulai-glyph" style={{ fontFamily: FONT }}>
        来
      </b>
    </div>
  );
}
