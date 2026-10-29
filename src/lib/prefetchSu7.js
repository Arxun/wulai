import { SU7_CAR } from '../config/assets';
import { publicUrl } from './publicUrl';

/**
 * 场景脚本到齐后再把 SU7 和 Draco 拉进缓存。
 * 用 prefetch，不和首屏脚本抢连接；不解码、不上传 GPU。
 */
export function prefetchSu7() {
  if (prefetchSu7.started || typeof document === 'undefined') return;
  prefetchSu7.started = true;

  const dir = SU7_CAR.gltf.replace(/[^/]+$/, '');
  const urls = [
    SU7_CAR.gltf,
    `${dir}sm_car_data.bin`,
    ...Array.from({ length: 9 }, (_, i) => `${dir}sm_car_img${i}.webp`),
    SU7_CAR.bodyAo,
    publicUrl('/draco/gltf/draco_wasm_wrapper.js'),
    publicUrl('/draco/gltf/draco_decoder.wasm'),
  ];

  for (const href of urls) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'fetch';
    link.href = href;
    link.crossOrigin = 'anonymous';
    link.fetchPriority = 'low';
    document.head.appendChild(link);
  }
}
prefetchSu7.started = false;
