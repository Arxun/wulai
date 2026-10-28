/** 虚拟方向键按下的 KeyboardEvent.code，与 useKeyboard / moveAxis 共用 */
export const mobileKeys = new Set();

const pressSubs = new Set();

export function setMobileKey(code, down) {
  if (down) mobileKeys.add(code);
  else mobileKeys.delete(code);
}

export function clearMobileKeys() {
  mobileKeys.clear();
}

/** 虚拟技能键等「点按」，与 keydown 的 onPress 同路径 */
export function emitMobilePress(code) {
  for (const fn of pressSubs) fn(code);
}

export function subscribeMobilePress(fn) {
  pressSubs.add(fn);
  return () => pressSubs.delete(fn);
}

const releaseSubs = new Set();

/** 虚拟键松开（跳跃蓄力等），与 keyup 的 onRelease 同路径 */
export function emitMobileRelease(code) {
  for (const fn of releaseSubs) fn(code);
}

export function subscribeMobileRelease(fn) {
  releaseSubs.add(fn);
  return () => releaseSubs.delete(fn);
}
