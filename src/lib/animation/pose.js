/**
 * 人物动作接口。头 / 躯干 / 双手 / 双腿各管一段，武器不在这份表里。
 *
 * 数组一律 [人物右侧(-X), 人物左侧(+X)]。
 *
 *   head     headYaw / headPitch          绕颈根
 *   torso    lean / twist / roll / bodyY  绕骨盆（前倾、扭腰、侧倾、重心高低）
 *   arms     shoulder / elbow / yaw / roll  上臂前摆、肘弯、向内合、手臂滚转
 *   legs     thigh / knee / ankle         大腿前摆、膝弯、脚尖下压
 *
 * 正值：肩/大腿向前，肘/膝弯曲，踝下压。
 * 武器挂在右手插槽里（见 scenes/game/weapons.jsx），换刀只换模型。
 */

import { ZERO_POSE } from './gait';

export { ZERO_POSE, blendPose } from './gait';

export const POSE_CHANNELS = ['head', 'torso', 'arms', 'legs'];

export function emptyPose() {
  return ZERO_POSE;
}
