import { ULT_SKILL_NAME } from '../../config/lore';

/**
 * 战斗动作表：姿态、时间、伤害、判定都写在这里。
 * 主角小武、怪物、特效都读同一份，加新招只改这个文件。
 *
 * t 一律 0~1。姿态走 pose.js 的四段接口（头 / 躯干 / 双手 / 双腿），不另加骨头。
 * 武器不在这张表里，右手插槽换模型即可。
 */

export const COMBO = ['stab', 'cleave', 'slash', 'spin'];
export const COMBO_GATE = 0.48;
export const COMBO_CANCEL = 0.52;

function env(t, a, b) {
  if (t <= a) return 0;
  if (t >= b) return Math.max(0, 1 - (t - b) / Math.max(0.001, 1 - b));
  return (t - a) / Math.max(0.001, b - a);
}

function peak(t, a, b) {
  if (t <= a || t >= b) return 0;
  const m = (t - a) / (b - a);
  return Math.sin(m * Math.PI);
}

/**
 * 两掌叠在握把上一起走。
 * swing = 叠掌挥出的远近；fold 蓄力时收在身前，打击时要降下去，杖才能抡出去。
 */
function staffHands(swing, elbow = 0.58, fold = 1) {
  return [
    { shoulder: swing, elbow, yaw: 0.46 * fold, roll: -0.94 * fold },
    { shoulder: swing - 0.04, elbow: elbow + 0.1, yaw: -0.4 * fold, roll: 0.88 * fold },
  ];
}

/** 刺：收到腰侧，整臂捅出去，再收回 */
export function stabPose(t) {
  const wind = t < 0.28 ? t / 0.28 : Math.max(0, 1 - (t - 0.28) / 0.1);
  const thrust = env(t, 0.22, 0.72);
  const rec = env(t, 0.72, 1);
  return {
    bodyY: -0.04 * wind + 0.06 * thrust,
    lean: -0.22 * wind + 0.48 * thrust,
    roll: 0.08 * thrust,
    twist: -0.32 * wind + 0.28 * thrust,
    legs: [
      { thigh: 0.18 * wind + 0.48 * thrust, knee: 0.14 * thrust, ankle: 0.08 * thrust },
      { thigh: -0.22 * thrust, knee: 0.12, ankle: 0 },
    ],
    arms: staffHands(
      0.18 + 0.12 * wind + 1.62 * thrust - 0.4 * rec,
      0.92 - 0.1 * wind - 0.52 * thrust + 0.18 * rec,
      0.9 - 0.68 * thrust + 0.22 * rec,
    ),
    headYaw: 0.08 * thrust,
    headPitch: 0.12 * thrust,
  };
}

/** 劈：仰身把杖举过肩，再连人带杖砸下去 */
export function cleavePose(t) {
  const up = t < 0.32 ? t / 0.32 : Math.max(0, 1 - (t - 0.32) / 0.12);
  const smash = env(t, 0.26, 0.78);
  return {
    bodyY: -0.08 * up + 0.05 * smash,
    lean: -0.42 * up + 0.72 * smash,
    roll: -0.12 * up - 0.18 * smash,
    twist: -0.16 * up + 0.4 * smash,
    legs: [
      { thigh: 0.48 * up + 0.1 * smash, knee: 0.62 * up, ankle: 0.14 * up },
      { thigh: 0.14 * up - 0.2 * smash, knee: 0.22 * up, ankle: 0.05 },
    ],
    arms: staffHands(1.08 + 0.58 * up + 0.22 * smash, 0.32 + 0.12 * up, 0.48 - 0.2 * smash),
    headYaw: -0.1 * smash,
    headPitch: -0.22 * up + 0.32 * smash,
  };
}

/** 砍：杖拉到身后，转腰横扫一线 */
export function slashPose(t) {
  const wind = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.1);
  const cut = env(t, 0.24, 0.78);
  return {
    bodyY: 0.02 * cut,
    lean: 0.1 * wind + 0.18 * cut,
    roll: 0.42 * wind - 0.68 * cut,
    twist: -1.12 * wind + 1.62 * cut,
    legs: [
      { thigh: 0.16 * wind + 0.2 * cut, knee: 0.16, ankle: 0.05 },
      { thigh: -0.12 * wind - 0.28 * cut, knee: 0.22, ankle: 0 },
    ],
    arms: staffHands(0.62 + 0.28 * wind + 0.55 * cut, 0.48 + 0.12 * wind, 0.72 - 0.48 * cut),
    headYaw: -0.28 * wind + 0.4 * cut,
    headPitch: 0.05,
  };
}

/** 旋：杖抡出去，整个人带着转一圈 */
export function spinPose(t) {
  const out = env(t, 0, 0.18);
  const hold = t > 0.18 && t < 0.84 ? 1 : out;
  const fade = t > 0.84 ? (1 - t) / 0.16 : 1;
  const spin = Math.sin(t * Math.PI * 2);
  const kick = peak(t, 0.12, 0.78);
  return {
    bodyY: 0.05 * hold,
    lean: 0.14 * hold,
    roll: spin * 0.32 * fade,
    twist: spin * 0.92 * fade,
    legs: [
      { thigh: 0.52 * kick, knee: 0.78 * kick, ankle: 0.12 * kick },
      { thigh: 0.1, knee: 0.14, ankle: 0.04 },
    ],
    arms: staffHands(1.15 * hold * fade + 0.55 * (1 - fade), 0.38, 0.22),
    headYaw: spin * -0.22,
    headPitch: -0.06 * hold,
  };
}

/** 跳起下砸：空中举杖，砸下去 1.5 倍 */
export function plungePose(t) {
  const hold = t < 0.28 ? t / 0.28 : Math.max(0, 1 - (t - 0.28) / 0.12);
  const slam = env(t, 0.26, 0.7);
  return {
    bodyY: 0.04 * hold - 0.06 * slam,
    lean: -0.22 * hold + 0.62 * slam,
    roll: -0.1 * slam,
    twist: 0.18 * slam,
    legs: [
      { thigh: 1.05 * hold + 0.08 * slam, knee: 1.55 * hold, ankle: 0.22 * hold },
      { thigh: 0.22 * hold + 0.12 * slam, knee: 0.2 * hold + 0.18 * slam, ankle: 0.08 },
    ],
    arms: staffHands(1.35 * hold + 0.4 * slam, 0.36, 0.35),
    headYaw: 0,
    headPitch: -0.26 * hold + 0.34 * slam,
  };
}

/** K 技能：侧身拉开，再整段横劈出去 */
export function skillPose(t) {
  const charge = t < 0.42 ? t / 0.42 : Math.max(0, 1 - (t - 0.42) / 0.1);
  const slam = t < 0.42 ? 0 : t < 0.7 ? (t - 0.42) / 0.28 : Math.max(0, 1 - (t - 0.7) / 0.3);
  return {
    bodyY: -0.16 * charge + 0.08 * slam,
    lean: -0.18 * charge + 0.52 * slam,
    roll: 0.28 * charge - 0.55 * slam,
    twist: -0.72 * charge + 1.35 * slam,
    legs: [
      { thigh: 0.68 * charge + 0.1 * slam, knee: 1.12 * charge + 0.06 * slam, ankle: 0.18 * charge },
      { thigh: 0.42 * charge - 0.24 * slam, knee: 0.82 * charge + 0.12 * slam, ankle: 0.12 * charge },
    ],
    arms: staffHands(0.55 + 0.25 * charge + 1.05 * slam, 0.62 + 0.12 * charge - 0.22 * slam, 0.75 - 0.5 * slam),
    headYaw: 0.18 * charge - 0.4 * slam,
    headPitch: -0.18 * charge + 0.32 * slam,
  };
}

/** E 回旋斩：杖抡在外侧，每 0.3 秒抽一圈 */
export function whirlPose(t) {
  const fade = t < 0.05 ? t / 0.05 : t > 0.9 ? Math.max(0, (1 - t) / 0.1) : 1;
  const rev = ((t * 3) / 0.3) % 1;
  const swing = rev < 0.58 ? Math.pow(rev / 0.58, 0.7) : 1 - (rev - 0.58) / 0.42;
  return {
    bodyY: 0,
    lean: 0,
    roll: 0,
    twist: (0.42 * swing - 0.12) * fade,
    legs: [
      { thigh: 0.14 * fade, knee: 0.16, ankle: 0.04 },
      { thigh: 0.08 * fade, knee: 0.1, ankle: 0.02 },
    ],
    arms: staffHands((0.75 + 0.7 * swing) * fade, 0.42, 0.28),
    headYaw: -0.16 * swing * fade,
    headPitch: 0,
  };
}

/** 大招「武来」：t 是整段 3 秒的 0~1。前摇站定，中段跟着法相挥，后摇收。 */
export function wulaiPose(t) {
  const sec = t * 3;
  if (sec < 0.4) {
    const k = sec / 0.4;
    return {
      bodyY: -0.04 * k,
      lean: 0.06 * k,
      roll: 0,
      twist: 0,
      legs: [
        { thigh: 0.18 * k, knee: 0.22 * k, ankle: 0.06 * k },
        { thigh: 0.16 * k, knee: 0.2 * k, ankle: 0.05 * k },
      ],
      arms: staffHands(0.62 * k, 0.6, 0.75 * k),
      headYaw: 0,
      headPitch: -0.08 * k,
    };
  }
  if (sec < 0.9) {
    const k = (sec - 0.4) / 0.5;
    return {
      bodyY: -0.1 + 0.08 * k,
      lean: -0.12 * k,
      roll: 0,
      twist: 0.08 * k,
      legs: [
        { thigh: 0.55 * (1 - k * 0.4), knee: 0.7 * (1 - k * 0.35), ankle: 0.12 },
        { thigh: 0.42 * (1 - k * 0.35), knee: 0.55 * (1 - k * 0.3), ankle: 0.1 },
      ],
      arms: staffHands(0.72 + 0.38 * k, 0.62, 0.55),
      headYaw: 0,
      headPitch: -0.2 * k,
    };
  }
  if (sec < 1.6) {
    const k = (sec - 0.9) / 0.7;
    return {
      bodyY: 0.02,
      lean: -0.16 - 0.08 * k,
      roll: 0.06,
      twist: -0.12,
      legs: [
        { thigh: 0.28, knee: 0.35, ankle: 0.08 },
        { thigh: 0.18, knee: 0.22, ankle: 0.06 },
      ],
      arms: staffHands(1.18 + 0.16 * k, 0.58, 0.4),
      headYaw: 0.08,
      headPitch: -0.28,
    };
  }
  if (sec < 2.4) {
    // 先举到顶，1.85 秒砸下去
    const hold = sec < 1.85 ? 1 : Math.max(0, 1 - (sec - 1.85) / 0.12);
    const slam = sec < 1.85 ? 0 : Math.min(1, (sec - 1.85) / 0.22);
    return {
      bodyY: -0.04 * hold + 0.05 * slam,
      lean: -0.28 * hold + 0.62 * slam,
      roll: 0.08 * hold - 0.32 * slam,
      twist: -0.18 * hold + 0.95 * slam,
      legs: [
        { thigh: 0.55 * hold + 0.22 * slam, knee: 0.85 * hold + 0.1 * slam, ankle: 0.16 * hold },
        { thigh: 0.22 * hold - 0.18 * slam, knee: 0.28 * hold, ankle: 0.08 },
      ],
      arms: staffHands(1.22 * hold + 0.55 * slam, 0.52 + 0.1 * hold, 0.45 + 0.4 * slam),
      headYaw: 0.1 * hold - 0.32 * slam,
      headPitch: -0.38 * hold + 0.42 * slam,
    };
  }
  const k = (sec - 2.4) / 0.6;
  return {
    bodyY: 0,
    lean: 0.18 * (1 - k),
    roll: -0.08 * (1 - k),
    twist: 0.25 * (1 - k),
    legs: [
      { thigh: 0.22 * (1 - k), knee: 0.16 * (1 - k), ankle: 0.04 },
      { thigh: 0.04, knee: 0.1, ankle: 0.02 },
    ],
    arms: staffHands(1.05 * (1 - k), 0.55, 0.6 * (1 - k)),
    headYaw: 0,
    headPitch: 0.06 * (1 - k),
  };
}

const POSES = {
  stab: stabPose,
  cleave: cleavePose,
  slash: slashPose,
  spin: spinPose,
  plunge: plungePose,
  skill: skillPose,
  wulai: wulaiPose,
  whirl: whirlPose,
};

/**
 * 招式数值。
 *   cone   人→怪 与朝向的夹角余弦下限。1 只打正前方，0 前方半圆，-1 四面
 *   range  到怪物身体边缘的距离（判定时还会加上怪物半径）
 *   spin   整个人转几圈（视觉）
 */
export const MOVES = {
  stab: {
    id: 'stab',
    name: '刺',
    time: 0.3,
    strike: [0.24, 0.7],
    mult: 1,
    range: 2.55,
    cone: 0.22,
    hitLock: 0.22,
    knock: 0.85,
    lunge: 4.2,
    color: '#e8f4ff',
  },
  cleave: {
    id: 'cleave',
    name: '劈',
    time: 0.36,
    strike: [0.28, 0.74],
    mult: 1.05,
    range: 2.6,
    cone: 0.08,
    hitLock: 0.24,
    knock: 1.2,
    color: '#ffe6b0',
  },
  slash: {
    id: 'slash',
    name: '砍',
    time: 0.38,
    strike: [0.26, 0.74],
    mult: 1.08,
    range: 2.7,
    cone: -0.12,
    hitLock: 0.24,
    knock: 1.35,
    color: '#ffd27a',
  },
  spin: {
    id: 'spin',
    name: '旋',
    time: 0.56,
    strike: [0.18, 0.82],
    mult: 1.15,
    range: 2.65,
    cone: -1,
    hitLock: 0.5,
    knock: 1.8,
    spin: 1,
    color: '#ffb84a',
  },
  plunge: {
    id: 'plunge',
    name: '下砸',
    time: 0.52,
    strike: [0.28, 0.7],
    mult: 1.5,
    range: 2.7,
    cone: 0.05,
    hitLock: 0.42,
    knock: 2.1,
    drop: 22,
    color: '#ff9a3c',
  },
  skill: {
    id: 'skill',
    name: '崩击',
    time: 0.92,
    strike: [0.44, 0.78],
    mult: 2.4,
    range: 3.5,
    cone: -0.1,
    hitLock: 0.62,
    knock: 2.8,
    color: '#ffd24a',
  },
  wulai: {
    id: 'wulai',
    name: ULT_SKILL_NAME,
    time: 3,
    strike: [1.6 / 3, 2.4 / 3],
    mult: 10,
    range: 13,
    cone: -1,
    hitLock: 2.2,
    knock: 3.4,
    color: '#ffd056',
    waveMin: 1.1,
    waveMax: 13,
    craterR: 6.5,
    craterLife: 5,
    craterTick: 0.5,
    craterMult: 0.5,
  },
  whirl: {
    id: 'whirl',
    name: '回旋斩',
    time: 3,
    strike: [0, 1],
    mult: 0.8,
    range: 3.15,
    cone: -1,
    hitLock: 0.3,
    knock: 0.35,
    spin: 10,
    color: '#ffe8a0',
    pulse: 0.3,
    mobile: true,
  },
};

export function moveOf(id) {
  return MOVES[id] || MOVES.stab;
}

/**
 * 这一刀能不能打到 (x, z) 处、半径 radius 的目标。
 * 只认三件事：出伤窗口、距离、朝向。范围外必不中，范围内且在扇形里必中。
 */
export function hitTest(world, x, z, radius = 0.5) {
  if (!world.striking) return false;
  if (!world.move && world.heavy <= 0) return false;
  const mv = moveOf(world.move || (world.heavy > 0 ? 'skill' : 'stab'));
  const toX = x - world.x;
  const toZ = z - world.z;
  const dist = Math.hypot(toX, toZ);
  if (mv.id === 'wulai') {
    const r = world.waveR || 0;
    return dist <= r + radius;
  }
  if (dist > mv.range + radius) return false;
  if (mv.cone <= -0.99) return true;
  const align = (toX * Math.sin(world.yaw) + toZ * Math.cos(world.yaw)) / Math.max(dist, 1e-4);
  return align >= mv.cone;
}

export function movePose(id, t) {
  const fn = POSES[id] || stabPose;
  return fn(t);
}

export function moveProgress(world) {
  const mv = moveOf(world.move);
  if (world.heavy > 0 && world.move === 'skill') return 1 - world.heavy / mv.time;
  if (world.swing > 0) return 1 - world.swing / mv.time;
  return 0;
}

export function applyMove(world, id) {
  const mv = moveOf(id);
  world.move = mv.id;
  world.queued = false;
  world.striking = false;
  world.spin = 0;
  if (mv.id === 'skill') {
    world.heavy = mv.time;
    world.swing = 0;
  } else {
    world.swing = mv.time;
    world.heavy = 0;
  }
}

/** 连按 J：地上刺→劈→砍→旋，空中下砸。回收段可以预输入下一刀。 */
export function tryLightAttack(world, { air = false } = {}) {
  if (world.lock || world.move === 'wulai' || world.move === 'whirl') return false;
  if (air) {
    if (world.swing > 0 || world.heavy > 0) return false;
    applyMove(world, 'plunge');
    world.combo = 0;
    world.comboGate = 0;
    return true;
  }
  if (world.heavy > 0) return false;
  if (world.swing > 0) {
    const t = moveProgress(world);
    if (t >= COMBO_CANCEL && !world.queued) world.queued = true;
    return false;
  }
  if (world.comboGate <= 0) world.combo = 0;
  const id = COMBO[world.combo] || 'stab';
  applyMove(world, id);
  world.combo = id === 'spin' ? 0 : world.combo + 1;
  world.comboGate = 0;
  return true;
}

export function trySkill(world) {
  if (world.lock || world.move === 'whirl' || world.swing > 0 || world.heavy > 0) return false;
  applyMove(world, 'skill');
  world.combo = 0;
  world.comboGate = 0;
  return true;
}

export function tryWhirl(world) {
  if (world.lock || world.move === 'wulai' || world.move === 'whirl' || world.heavy > 0) return false;
  applyMove(world, 'whirl');
  world.combo = 0;
  world.comboGate = 0;
  world.queued = false;
  return true;
}

export function tryWulai(world) {
  if (world.lock || world.move === 'whirl' || world.swing > 0 || world.heavy > 0) return false;
  applyMove(world, 'wulai');
  world.lock = true;
  world.waveR = 0;
  world.craterArmed = false;
  world.combo = 0;
  world.comboGate = 0;
  world.queued = false;
  return true;
}

function tickCrater(world, dt) {
  const pit = world.crater;
  if (!pit?.on) return;
  pit.age += dt;
  if (pit.age >= (MOVES.wulai.craterLife || 5)) pit.on = false;
}

/** 坑里的怪是否在持续灼烧范围内。 */
export function craterHit(world, x, z, radius = 0.5) {
  const pit = world.crater;
  if (!pit?.on) return false;
  return Math.hypot(x - pit.x, z - pit.z) <= pit.r + radius;
}

/** 每帧推进计时、出伤窗口、预输入。 */
export function tickMoves(world, dt) {
  tickCrater(world, dt);
  if (world.heavy > 0) {
    world.heavy = Math.max(0, world.heavy - dt);
    const t = 1 - world.heavy / MOVES.skill.time;
    world.striking = t >= MOVES.skill.strike[0] && t <= MOVES.skill.strike[1];
    world.spin = 0;
    if (world.heavy <= 0) {
      world.striking = false;
      world.move = '';
    }
    return;
  }

  if (world.swing > 0) {
    const mv = moveOf(world.move);
    world.swing = Math.max(0, world.swing - dt);
    const t = mv.time ? 1 - world.swing / mv.time : 0;
    world.striking = t >= mv.strike[0] && t <= mv.strike[1];
    world.spin = (mv.spin || 0) * t * Math.PI * 2;
    if (mv.id === 'whirl') {
      const sec = t * mv.time;
      // 整段都可命中：范围内的怪每 0.3s 挨一下，中途走进来的也会立刻掉血
      world.striking = sec < 2.98;
      const pulse = mv.pulse || 0.3;
      const rev = sec / pulse;
      const i = Math.floor(rev);
      const f = rev - i;
      const eased = f < 0.55 ? Math.pow(f / 0.55, 0.78) * 0.55 : 0.55 + ((f - 0.55) / 0.45) * 0.45;
      world.spin = (i + eased) * Math.PI * 2;
    }
    if (mv.id === 'wulai') {
      const sec = t * mv.time;
      if (sec >= 1.85 && sec <= 2.4) {
        const k = (sec - 1.85) / 0.55;
        world.waveR = mv.waveMin + (mv.waveMax - mv.waveMin) * k;
      } else if (sec < 1.85) {
        world.waveR = 0;
      }
      if (sec >= 1.85 && !world.craterArmed) {
        world.craterArmed = true;
        world.crater = {
          on: true,
          x: world.x,
          y: world.y,
          z: world.z,
          r: mv.craterR || 6.5,
          age: 0,
        };
      }
    }
    if (world.swing > 0) return;
    world.striking = false;
    world.spin = 0;
    world.lock = false;
    world.waveR = 0;
    if (mv.id === 'wulai') {
      world.move = '';
      return;
    }
    if (world.queued) {
      world.queued = false;
      const id = COMBO[world.combo] || 'stab';
      applyMove(world, id);
      world.combo = id === 'spin' ? 0 : world.combo + 1;
      return;
    }
    world.comboGate = COMBO_GATE;
    world.move = '';
    return;
  }

  if (world.comboGate > 0) {
    world.comboGate = Math.max(0, world.comboGate - dt);
    if (world.comboGate <= 0) world.combo = 0;
  }

  if (world.lock && world.swing <= 0 && world.heavy <= 0) {
    world.lock = false;
    if (world.move === 'wulai') world.move = '';
  }

  if (world.lock && world.move !== 'wulai' && world.swing <= 0 && world.heavy <= 0) {
    world.lock = false;
    world.move = '';
  }
}

export function resetMoves(world) {
  world.move = '';
  world.swing = 0;
  world.heavy = 0;
  world.striking = false;
  world.queued = false;
  world.combo = 0;
  world.comboGate = 0;
  world.spin = 0;
  world.lock = false;
  world.waveR = 0;
  world.craterArmed = false;
  if (world.crater) world.crater.on = false;
}
