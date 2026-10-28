import * as THREE from 'three';

/**
 * 步态：把"当前速度 + 走了多远"换算成一整套关节角度，纯函数，不依赖 React / three 的场景。
 *
 * 相位 phase 是**按走过的距离**累加的（不是按时间），所以快走慢走脚都不会在地上打滑：
 *   phase += 位移 / stride，一个 phase 周期 = 迈出左右各一步。
 *
 * 一个周期内（以人物右腿为准）：
 *   0.00 摆动中期（腿从后往前经过身体正下方，膝弯最大，脚要抬起来避开地面）
 *   0.25 大腿前摆到顶，膝盖伸直，准备落地
 *   0.30 脚跟触地
 *   0.50 支撑中期（腿垂直，膝直，重心最高）
 *   0.75 大腿后摆到顶，脚尖离地
 *   0.90 摆动早期，膝弯迅速加大
 *
 * 角度符号（人物面朝 +Z）：
 *   大腿 thigh / 上臂 shoulder —— 正值表示**向前**摆（施加到 rotation.x 时要取负）
 *   膝 knee / 肘 elbow        —— 正值表示弯曲量（膝向后弯、肘向前弯）
 *   踝 ankle                  —— 正值表示脚尖下压（蹬地）
 */

const TAU = Math.PI * 2;
const { lerp, clamp, smoothstep } = THREE.MathUtils;

/** 走路和奔跑的速度（米/秒）。游戏节奏优先，比真人快一截 */
export const WALK_SPEED = 2.8;
export const RUN_SPEED = 7.4;

const WALK = {
  // stride 必须和腿能迈出的距离对得上（约 2×腿长×sin(thigh)），不然脚会在地上打滑
  stride: 1.25, // 一个周期（左右各一步）走过的距离
  thigh: 0.5,
  kneeBase: 0.05,
  knee: 0.92,
  ankle: 0.22,
  shoulder: 0.38,
  elbowBase: 0.22,
  elbow: 0.3,
  bob: 0.026,
  bobPhase: 0, // 重心最低点出现在双脚支撑时
  roll: 0.03,
  twist: 0.08,
  lean: 0.045,
};

const RUN = {
  stride: 2.2,
  thigh: 0.9,
  kneeBase: 0.22,
  knee: 1.62,
  ankle: 0.36,
  shoulder: 0.74,
  elbowBase: 0.85,
  elbow: 0.54,
  bob: 0.062,
  bobPhase: Math.PI, // 奔跑有腾空期：支撑中期最低、腾空时最高
  roll: 0.05,
  twist: 0.16,
  lean: 0.24,
};

const KEYS = Object.keys(WALK);

/**
 * 插值出一套步态参数。
 * @param {number} speed 当前速度（米/秒）
 * @param {number} [runMix] 奔跑程度 0~1。按住 Shift 时由输入直接给 1，
 *   这样一按就是跑的姿态，不用等速度涨上来；不传则只按速度推断。
 */
export function gaitParams(speed, runMix = 0) {
  const t = Math.max(smoothstep(speed, WALK_SPEED * 1.1, RUN_SPEED * 0.85), clamp(runMix, 0, 1));
  const out = {};
  for (const k of KEYS) out[k] = lerp(WALK[k], RUN[k], t);
  return out;
}

/** 站立姿态：两腿垂直、手臂自然下垂，只有极轻微的呼吸 */
function restPose(time) {
  const breath = Math.sin(time * 1.3);
  return {
    bodyY: breath * 0.0022,
    lean: 0,
    roll: 0,
    twist: Math.sin(time * 0.5) * 0.012,
    legs: [
      { thigh: 0, knee: 0, ankle: 0 },
      { thigh: 0, knee: 0, ankle: 0 },
    ],
    arms: [
      { shoulder: Math.sin(time * 0.9) * 0.012, elbow: 0.16 + breath * 0.01, yaw: 0, roll: 0 },
      { shoulder: Math.sin(time * 0.9 + 1.2) * 0.012, elbow: 0.16 - breath * 0.01, yaw: 0, roll: 0 },
    ],
    headYaw: Math.sin(time * 0.37) * 0.05,
    headPitch: 0,
  };
}

/**
 * 算出当前帧的全身姿态。
 * @param {object} o
 * @param {number} o.phase 步态相位（由位移累加，见文件头）
 * @param {number} o.speed 当前水平速度（米/秒）
 * @param {number} o.time  场景时间（秒），用于站立时的呼吸
 * @param {number} [o.turn] 转向量，给身体一点侧倾
 * @param {number} [o.runMix] 奔跑程度 0~1，见 gaitParams
 * @returns 关节角度表，数组顺序是 [人物右侧, 人物左侧]
 */
export function gaitPose({ phase, speed, time, turn = 0, runMix = 0 }) {
  // 速度很低时整体淡回站立姿态，避免原地抽搐。
  // 这里用绝对速度而不是 WALK_SPEED 的倍数——调高走速不该让起步变迟钝
  const amp = smoothstep(speed, 0.12, 1.1);
  const rest = restPose(time);
  if (amp <= 0.001) return rest;

  const g = gaitParams(speed, runMix);
  const legAngles = [];
  const armAngles = [];

  // 右腿用 phase，左腿错开半个周期；手臂和同侧腿反向（对侧摆臂）
  for (let i = 0; i < 2; i++) {
    const p = phase + i * 0.5;
    const th = TAU * p;
    legAngles.push({
      thigh: g.thigh * Math.sin(th),
      // 膝弯在 p≈0.95（摆动早期）最大、p≈0.45（支撑中期）最小
      knee: g.kneeBase + g.knee * (0.5 - 0.5 * Math.cos(TAU * (p - 0.95))),
      ankle: g.ankle * Math.sin(TAU * (p - 0.45)),
    });
    const ap = phase + (1 - i) * 0.5;
    armAngles.push({
      shoulder: g.shoulder * Math.sin(TAU * ap),
      elbow: g.elbowBase + g.elbow * (0.5 + 0.5 * Math.sin(TAU * ap)),
      yaw: 0,
      roll: 0,
    });
  }

  const th = TAU * phase;
  const pose = {
    // 重心一个周期上下两次
    bodyY: -g.bob * (0.5 - 0.5 * Math.cos(2 * th + g.bobPhase)),
    lean: g.lean,
    roll: g.roll * Math.sin(th) - clamp(turn, -1, 1) * 0.12,
    twist: g.twist * Math.sin(th),
    legs: legAngles,
    arms: armAngles,
    // 头反向转一点，让视线保持朝前；跑起来略微抬头
    headYaw: -g.twist * Math.sin(th) * 0.5,
    headPitch: -g.lean * 0.55,
  };

  if (amp >= 0.999) return pose;
  return blendPose(rest, pose, amp);
}

/** 两套姿态之间线性插值（起步 / 停步时用） */
export function blendPose(a, b, t) {
  const j = (x, y) => lerp(x, y, t);
  return {
    bodyY: j(a.bodyY, b.bodyY),
    lean: j(a.lean, b.lean),
    roll: j(a.roll, b.roll),
    twist: j(a.twist, b.twist),
    legs: a.legs.map((leg, i) => ({
      thigh: j(leg.thigh, b.legs[i].thigh),
      knee: j(leg.knee, b.legs[i].knee),
      ankle: j(leg.ankle, b.legs[i].ankle),
    })),
    arms: a.arms.map((arm, i) => ({
      shoulder: j(arm.shoulder, b.arms[i].shoulder),
      elbow: j(arm.elbow, b.arms[i].elbow),
      yaw: j(arm.yaw ?? 0, b.arms[i].yaw ?? 0),
      roll: j(arm.roll ?? 0, b.arms[i].roll ?? 0),
    })),
    headYaw: j(a.headYaw, b.headYaw),
    headPitch: j(a.headPitch, b.headPitch),
  };
}

/**
 * 跳跃姿态：蓄力下蹲 / 蹬地伸展 / 腾空 / 落地缓冲。
 *
 * 全是现有关节角，不另加骨骼。charge / air / launch / land 都是 0~1，
 * 可以叠：蓄到一半松手，就是半蹲直接蹬出去。
 *
 * @param {object} o
 * @param {number} [o.charge] 蓄力 0~1（下蹲）
 * @param {number} [o.air]    离地程度 0~1
 * @param {number} [o.vy]     竖直速度，用来分上升 / 下落
 * @param {number} [o.land]   落地缓冲 0~1
 * @param {number} [o.launch] 刚离地那一下的蹬伸 0~1
 */
export function jumpPose({ charge = 0, air = 0, vy = 0, land = 0, launch = 0 }) {
  const squat = clamp(Math.max(charge, land), 0, 1);
  const up = clamp(vy / 10, 0, 1);
  const down = clamp(-vy / 12, 0, 1);

  const crouch = {
    bodyY: -0.18 * squat,
    lean: 0.36 * squat,
    roll: 0,
    twist: 0,
    legs: [
      { thigh: 0.62 * squat, knee: 1.35 * squat, ankle: 0.22 * squat },
      { thigh: 0.58 * squat, knee: 1.28 * squat, ankle: 0.2 * squat },
    ],
    arms: [
      { shoulder: -0.62 * squat, elbow: 0.38 + 0.28 * squat },
      { shoulder: -0.56 * squat, elbow: 0.36 + 0.24 * squat },
    ],
    headYaw: 0,
    headPitch: 0.22 * squat,
  };

  // 蹬地：腿几乎伸直、脚尖下压、手臂从身后往前甩
  const push = {
    bodyY: 0.04,
    lean: 0.08,
    roll: 0,
    twist: 0,
    legs: [
      { thigh: 0.04, knee: 0.06, ankle: 0.35 },
      { thigh: 0.02, knee: 0.05, ankle: 0.32 },
    ],
    arms: [
      { shoulder: 0.55, elbow: 0.18 },
      { shoulder: 0.48, elbow: 0.16 },
    ],
    headYaw: 0,
    headPitch: -0.12,
  };

  // 腾空：一条腿蜷起、另一条相对伸着，双手举过头顶 —— 常见的跳跃剪影。
  const fly = {
    bodyY: 0.02,
    lean: -0.06 * up + 0.12 * down,
    roll: 0,
    twist: 0.02,
    legs: [
      { thigh: 1.05, knee: 1.68, ankle: 0.32 }, // 收起的那条
      { thigh: 0.18 + 0.12 * down, knee: 0.16 + 0.28 * down, ankle: 0.06 },
    ],
    arms: [
      { shoulder: 1.55, elbow: 0.12 },
      { shoulder: 1.48, elbow: 0.14 },
    ],
    headYaw: 0,
    headPitch: -0.18 * up + 0.12 * down,
  };

  let pose = crouch;
  if (air > 0.001) pose = blendPose(pose, fly, clamp(air, 0, 1));
  // 蹬地叠在腾空上面：刚离地那 0.12 秒先看得到腿伸直，再收到空中姿势
  if (launch > 0.001) pose = blendPose(pose, push, clamp(launch, 0, 1));
  return pose;
}

/** 空姿态（所有关节归零），用来初始化 ref */
export const ZERO_POSE = restPose(0);
