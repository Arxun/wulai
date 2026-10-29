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

import {
  mobileKeys,
  subscribeMobilePress,
  subscribeMobileRelease,
} from '../../scenes/game/mobile/mobileInputStore';

const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

/** 武来模式用到的键：capture 阶段抢先处理，避免焦点在面板滑条/按钮上时被浏览器吃掉 */
const GAME_KEYS = new Set([
  ...BLOCK,
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'KeyF',
  'KeyQ',
  'KeyE',
  'KeyJ',
  'KeyK',
  'KeyR',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad4',
  'Numpad5',
  'Numpad6',
]);

const MODIFIERS = new Set(['AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

function blurFocusedControl() {
  const el = document.activeElement;
  if (!el || el === document.body) return;
  if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement || el instanceof HTMLTextAreaElement) {
    el.blur();
  }
}

export function useKeyboard(onPress, onRelease) {
  const keys = useRef(new Set());
  const cb = useRef(onPress);
  const cbUp = useRef(onRelease);
  cb.current = onPress;
  cbUp.current = onRelease;
  useEffect(() => {
    const down = (e) => {
      if (GAME_KEYS.has(e.code)) {
        e.preventDefault();
        blurFocusedControl();
      }
      if (!e.repeat) cb.current?.(e.code);
      keys.current.add(e.code);
    };
    const up = (e) => {
      keys.current.delete(e.code);
      cbUp.current?.(e.code);
      if (MODIFIERS.has(e.code)) keys.current.clear();
    };
    const clearKeys = () => keys.current.clear();
    const onVis = () => {
      if (document.hidden) clearKeys();
    };
    const opts = { capture: true, passive: false };
    document.addEventListener('keydown', down, opts);
    document.addEventListener('keyup', up, opts);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', onVis);
    const unsubMobile = subscribeMobilePress((code) => {
      cb.current?.(code);
    });
    const unsubMobileUp = subscribeMobileRelease((code) => {
      cbUp.current?.(code);
    });
    return () => {
      document.removeEventListener('keydown', down, opts);
      document.removeEventListener('keyup', up, opts);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', onVis);
      unsubMobile();
      unsubMobileUp();
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
  const k = (...names) => names.some((n) => keys.has(n) || mobileKeys.has(n));
  const y = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
  const x = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
  return { x, y, drift: k('ShiftLeft', 'ShiftRight') };
}
