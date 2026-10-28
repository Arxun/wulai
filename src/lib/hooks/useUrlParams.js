/**
 * 读取 URL 查询参数（只在首次渲染读取一次），带类型转换的小工具。
 * 用途：调试 / 截图时 `?mode=parallax&ui=0&strength=1.2`。
 */
const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

export const urlParam = {
  /** 字符串，缺省返回 fallback */
  string: (key, fallback = '') => params.get(key) ?? fallback,
  /** 数字，缺省或非法返回 fallback */
  number: (key, fallback = 0) => {
    const v = Number(params.get(key));
    return params.has(key) && Number.isFinite(v) ? v : fallback;
  },
  /** 布尔：`0` / `false` 为 false，其它出现过的值为 true，缺省返回 fallback */
  bool: (key, fallback = false) => {
    if (!params.has(key)) return fallback;
    const v = params.get(key);
    return !(v === '0' || v === 'false');
  },
  /** 数字向量，如 `cam=0,2,8`；缺省或长度不对返回 fallback */
  vec: (key, fallback = null, length = 3) => {
    if (!params.has(key)) return fallback;
    const arr = params.get(key).split(',').map(Number);
    return arr.length === length && arr.every(Number.isFinite) ? arr : fallback;
  },
};

export default function useUrlParams() {
  return urlParam;
}
