/** 浏览器空闲时执行（无 rIC 时用短 timeout 兜底） */
export function runWhenIdle(fn, { timeout = 2500 } = {}) {
  return new Promise((resolve) => {
    const run = () => {
      try {
        resolve(fn());
      } catch (err) {
        resolve(Promise.reject(err));
      }
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout });
    } else {
      setTimeout(run, 80);
    }
  });
}
