import { distanceToFitSphere } from '../lib/camera';
import { LOWPOLY_CAMERA, LOWPOLY_TARGET, PHOTO_PARALLAX } from './assets';
import { GAME_TITLE, HERO_NAME, ULT_SKILL_NAME } from './lore';

/**
 * 三种查看模式的配置：标题、相机、操作提示。
 * 新增模式只需要在这里加一项，并在 App 里挂上对应场景。
 */
const FULL_FOV = 35;

export const MODES = {
  full: {
    label: '360° 模型',
    tag: '360° 完整模型',
    hint: '拖动旋转 · 滚轮缩放 · 右键平移',
    camera: {
      fov: FULL_FOV,
      position: [0, 1.0, distanceToFitSphere(1.1, FULL_FOV)],
      near: 0.05,
      far: 100,
    },
  },
  parallax: {
    label: '照片视差',
    tag: '照片 3D（2.5D 视差）',
    hint: '移动鼠标 / 手指改变视角（仅小角度）',
    camera: { fov: PHOTO_PARALLAX.fov, position: [0, 0, PHOTO_PARALLAX.camDistance], near: 0.1, far: 50 },
  },
  lowpoly: {
    label: '低多边形',
    tag: '低多边形',
    hint: '拖动旋转 · 滚轮缩放 · 右键平移',
    camera: LOWPOLY_CAMERA,
    target: LOWPOLY_TARGET,
  },
  game: {
    label: GAME_TITLE,
    tag: `${GAME_TITLE} · ${HERO_NAME} · 黄山步道`,
    hint: `连按 J 刺/劈/砍/旋 · 空中 J 下砸 · E 回旋斩 · K 崩击 · L ${ULT_SKILL_NAME}（大招） · 靠近 SU7 按 F 上下车 · 拾取 Q/W 吃药`,
    // 相机位置每帧由 Player 接管，这里只给一个初始值
    camera: { fov: 55, position: [6, 6, 76], near: 0.1, far: 1100 },
  },
};

export const DEFAULT_MODE = 'full';
