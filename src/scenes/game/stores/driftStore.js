/**
 * 漂移 / 氮气的玩法数值和运行时状态。
 *
 * 状态放在模块级的单例对象里：玩家控制器每帧写它，右上角 HUD 定时读它。
 * 这样既不用把 ref 从 Canvas 外面一层层传进去，也不会因为每帧 setState 把 React 拖垮
 * （场景里只有一个玩家，单例够用）。
 */

/** 攒满一瓶氮气需要的漂移距离（米） */
export const NITRO_COST = 20;
/** 最多存几瓶 */
export const NITRO_MAX = 3;
/** 一次氮气持续多久（秒） */
export const BOOST_TIME = 3;
/** 氮气期间的速度倍率 */
export const BOOST_MULT = 3;
/** 胎痕（鞋底摩擦痕）保留多久（秒） */
export const SKID_LIFE = 10;
/** 判定为"在漂移"的最小侧滑角（弧度）和最小速度（米/秒） */
export const DRIFT_SLIP = 0.22;
export const DRIFT_MIN_SPEED = 3;

export const drift = {
  /** 本次漂移已累计的距离（米），松手归零 */
  dist: 0,
  /** 当前这段连续漂移的距离，用来做 HUD 上的高亮 */
  combo: 0,
  /** 朝下一瓶氮气攒的进度 0~1 */
  progress: 0,
  /** 已存的氮气瓶数 */
  nitro: 0,
  /** 氮气剩余时间（秒），> 0 表示正在喷 */
  boost: 0,
  /** 是否正在漂移（给 HUD 做高亮） */
  sliding: false,
  /** 总漂移距离（米），一局累计 */
  total: 0,
  /** 当前速度（米/秒） */
  speed: 0,
  /** 跳跃蓄力 0~1，HUD 用 */
  jumpCharge: 0,
  /** 是否在空中 */
  air: false,
};

/** 消耗一瓶氮气并开始喷射；已在喷 / 没库存时返回 false */
export function tryActivateNitro() {
  if (drift.nitro <= 0 || drift.boost > 0) return false;
  drift.nitro -= 1;
  drift.boost = BOOST_TIME;
  return true;
}

export function resetDrift() {
  drift.dist = 0;
  drift.combo = 0;
  drift.progress = 0;
  drift.nitro = 0;
  drift.boost = 0;
  drift.sliding = false;
  drift.total = 0;
  drift.speed = 0;
  drift.jumpCharge = 0;
  drift.air = false;
}
