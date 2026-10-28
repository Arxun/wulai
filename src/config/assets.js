import { fovToFitPlane } from '../lib/camera';
import { urlParam } from '../lib/hooks/useUrlParams';

/**
 * 《武来》素材配置（换一张照片 / 一个模型时只需要改这里）。
 */

/** 参考照片（576×1024） */
export const REFERENCE_PHOTO = {
  url: '/reference.jpg',
  width: 576,
  height: 1024,
  aspect: 1024 / 576,
};

/** 2.5D 视差模式：由 tools/photo3d 生成的素材 */
export const PHOTO_PARALLAX = {
  aspect: REFERENCE_PHOTO.aspect,
  // 拍摄相机到照片平面的距离；FOV 由它反推，使照片刚好铺满画面
  camDistance: 2.2,
  get fov() {
    return fovToFitPlane(this.aspect, this.camDistance);
  },
  color: '/photo3d/color.jpg',
  depth: '/photo3d/depth.png',
  bgColor: '/photo3d/bg-color.jpg',
  bgDepth: '/photo3d/bg-depth.png',
};

/** 360° 完整模型：由 tools/image-to-3d 生成。meta 文件描述模型的朝向 / 投影参数等 */
export const FULL_MODEL = {
  glb: '/models/person.glb',
  meta: '/models/person.json',
};

/** SU7 整车 glTF（自 su7-replica 拷贝，meshopt 压缩） */
export const SU7_CAR = {
  gltf: '/models/su7/sm_car.gltf',
  bodyAo: '/models/su7/t_car_body_AO.raw.jpg',
};

/** 低多边形模式的取景：竖构图 9:16，头顶距画面上沿约 6% */
export const LOWPOLY_CAMERA = {
  fov: 52,
  // 调试：?cam=x,y,z 可改相机位置，?tgt=x,y,z 可改注视点
  position: urlParam.vec('cam', [0, 0.934, 1.97]),
  near: 0.05,
  far: 400,
};
export const LOWPOLY_TARGET = urlParam.vec('tgt', [0, 0.934, 0]);
