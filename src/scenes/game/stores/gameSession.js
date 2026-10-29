import { resetCombat } from './combatStore';
import { resetDrift } from './driftStore';
import { vehicle } from '../vehicles/runtime';

/**
 * 一局游戏的会话：等级 / 装备 / 氮气 / 人物位置与镜头都挂在这里，独立于 Canvas。
 *
 * 屏幕旋转、移动端布局切换都会让 Canvas 整个 remount，Player 也随之重建；
 * 会话只在离开游戏模式时重置，所以 remount 后接着玩，不回出生点、不掉级。
 */

/** Player 的可变运动状态（位置 / 朝向 / 镜头等），首次挂载时由 Player 创建 */
let playerState = null;

export function getPlayerState(create) {
  if (!playerState) playerState = create();
  return playerState;
}

export function resetGameSession() {
  playerState = null;
  resetDrift();
  resetCombat();
  vehicle.inCar = false;
  vehicle.near = false;
}

resetGameSession();
