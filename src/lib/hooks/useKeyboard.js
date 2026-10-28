import { useEffect, useRef } from 'react';

/**
 * 键盘状态：返回一个装着"当前按下的键"的 ref（Set，存 KeyboardEvent.code）。
 * 用 ref 而不是 state，按键不会引起重渲染，适合在 useFrame 里轮询。
 *
 * 同时把方向键 / 空格的默认滚页行为挡掉。
 *
 * @param {(code: string) => void} [onPress] 按下的那一下回调（自动重复不算）。
 * @param {(code: string) => void} [onRelease] 松开的那一下。
 *   轮询只能看到"按着"的键：短按一下如果整个夹在两帧之间就会被漏掉，
 *   所以放氮气、点按跳跃这种一次性操作要走回调，不要在 useFrame 里自己判边沿。
 */

const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export function useKeyboard(onPress, onRelease) {
  const keys = useRef(new Set());
  const cb = useRef(onPress);
  const cbUp = useRef(onRelease);
  cb.current = onPress;
  cbUp.current = onRelease;
  useEffect(() => {
    const down = (e) => {
      if (BLOCK.has(e.code)) e.preventDefault();
      if (!e.repeat) cb.current?.(e.code);
      keys.current.add(e.code);
    };
    const up = (e) => {
      keys.current.delete(e.code);
      cbUp.current?.(e.code);
    };
    // 切到别的窗口时松开所有键，避免回来还在"一直往前跑"
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  return keys;
}

/**
 * 把按键集合翻译成移动输入。
 *   x / y   -1~1，x 右正、y 前正（长按本身就是加速，不需要额外的加速键）
 *   drift   Shift：和左右方向一起按才会漂移
 * 氮气（Ctrl）是一次性操作，走 useKeyboard 的 onPress，不在这里。
 */
export function moveAxis(keys) {
  const k = (...names) => names.some((n) => keys.has(n));
  const y = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
  const x = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
  return { x, y, drift: k('ShiftLeft', 'ShiftRight') };
}
