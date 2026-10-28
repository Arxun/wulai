/**
 * `public/` 目录资源的 URL，自动带上 Vite `base`（如 `/wulai/`）。
 * @param {string} path 以 `/` 开头或不含前缀均可，例如 `/models/su7/sm_car.gltf`
 */
export function publicUrl(path) {
  const clean = String(path).replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${clean}`;
}
