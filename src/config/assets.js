import { fovToFitPlane } from '../lib/camera';
import { urlParam } from '../lib/hooks/useUrlParams';
import { publicUrl } from '../lib/publicUrl';

/**
 * 素材路径集中配置。
 * - 武来 / 低多边形：常用
 * - 照片视差 / 360° 模型：已下线，保留路径便于恢复 legacy 场景
 *
 * public/ 下文件须经 publicUrl，以兼容 vite.config `base: '/wulai/'`。
 */

/** 参考照片（低多边形对照、叠加层） */
export const REFERENCE_PHOTO = {
  url: publicUrl('/reference.jpg'),
  width: 576,
  height: 1024,
  aspect: 1024 / 576,
};

/** 武来 · SU7 glTF */
export const SU7_CAR = {
  gltf: publicUrl('/models/su7/sm_car.gltf'),
  bodyAo: publicUrl('/models/su7/t_car_body_AO.raw.jpg'),
};

/** 低多边形模式取景：竖构图 9:16 */
export const LOWPOLY_CAMERA = {
  fov: 52,
  position: urlParam.vec('cam', [0, 0.934, 1.97]),
  near: 0.05,
  far: 400,
};
export const LOWPOLY_TARGET = urlParam.vec('tgt', [0, 0.934, 0]);

/* —— legacy：照片视差 / 360° 模型（见 scenes/_legacy/）—— */

/** @deprecated 入口已隐藏 */
export const PHOTO_PARALLAX = {
  aspect: REFERENCE_PHOTO.aspect,
  camDistance: 2.2,
  get fov() {
    return fovToFitPlane(this.aspect, this.camDistance);
  },
  color: publicUrl('/photo3d/color.jpg'),
  depth: publicUrl('/photo3d/depth.png'),
  bgColor: publicUrl('/photo3d/bg-color.jpg'),
  bgDepth: publicUrl('/photo3d/bg-depth.png'),
};

/** @deprecated 入口已隐藏 */
export const FULL_MODEL = {
  glb: publicUrl('/models/person.glb'),
  meta: publicUrl('/models/person.json'),
};
