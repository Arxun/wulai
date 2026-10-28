/** 移动端视角：双指捏合调节相机距离（Player 每帧读取） */
export const mobileView = {
  /** 相对滚轮基准的乘数，1 = 默认 */
  camDistMult: 1,
};

const CAM_DIST_MIN = 2.8;
const CAM_DIST_MAX = 18;
const BASE_CAM_DIST = 5.2;

export function resetMobileCamDistMult() {
  mobileView.camDistMult = 1;
}

/** @param {number} mult */
export function setMobileCamDistMult(mult) {
  mobileView.camDistMult = Math.min(CAM_DIST_MAX / BASE_CAM_DIST, Math.max(CAM_DIST_MIN / BASE_CAM_DIST, mult));
}

export { CAM_DIST_MIN, CAM_DIST_MAX, BASE_CAM_DIST };
