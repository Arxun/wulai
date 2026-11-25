import { MOVES, resetMoves } from '../../../lib/animation/combatMoves';
import { HALF } from '../maps/huangshan/heightfield';

/**
 * 战斗数值：等级 / 经验 / 攻防血蓝 / 装备 / 掉落 / 飘字。
 *
 * 和 driftStore 一样是模块单例——玩家、怪物、左上角 HUD 都读这份，
 * 不走 React props，打一下不会把整棵树重渲染一遍。
 * 招式姿态和连段在 lib/animation/combatMoves.js。
 */

export const LEVEL_MAX = 99;

/** 死亡后多久回出生点（秒） */
export const DEATH_RESPAWN_SEC = 3;

/** 1 级的人物底板（不含武器）。用户指定：攻击 10、防御 5 */
export const BASE = { hp: 120, mp: 40, atk: 10, def: 5 };

/**
 * 升到下一级要多少经验。
 *   1→2 只要 28，前十级手感快；后面按 lv² 拉开，99 级不是刷一会儿就到。
 */
export function xpToNext(level) {
  if (level >= LEVEL_MAX) return 0;
  return Math.floor(22 * level + 6 * level * level);
}

/** 某一级的人物白板属性（不含武器） */
export function statsAt(level) {
  const n = Math.max(1, Math.min(LEVEL_MAX, level)) - 1;
  return {
    maxHp: BASE.hp + n * 8 + Math.floor(n * n * 0.04),
    maxMp: BASE.mp + n * 3 + Math.floor(n * 0.2),
    atk: BASE.atk + n * 2 + Math.floor(n / 10),
    def: BASE.def + n * 1 + Math.floor(n / 12),
  };
}

/** 武器表。atk 是加算；color 只给背包格子上色用。 */
export const WEAPONS = {
  wood: { id: 'wood', name: '木质登山杖', atk: 10, color: '#e4d0a4', hint: '出门随便砍的一根', desc: '山路上随手折下的木杖。不趁手，但出门总比空着手强。' },
  iron: { id: 'iron', name: '玄铁短戟', atk: 28, color: '#c5cdd6', hint: '路边铁匠随手打的', desc: '铁匠铺里打出来的短戟，分量压手，戳出去比木杖疼得多。' },
  frost: { id: 'frost', name: '霜华杖', atk: 48, color: '#b7e7ff', hint: '杖头结着不化的冰', desc: '杖头凝着一层不化的霜。打在身上先是疼，接着是麻。' },
  ember: { id: 'ember', name: '赤焰矛', atk: 76, color: '#ff7a2a', hint: '矛尖一直在烧', desc: '矛尖常年烧着。靠近时能感到热气，刺中会多带一层灼痛。' },
  storm: { id: 'storm', name: '雷纹刀', atk: 118, color: '#9ecbff', hint: '刃上走着细雷', desc: '刀身刻着雷纹，挥起来有细碎的电光顺着刃走。' },
  blood: { id: 'blood', name: '血棘魔剑', atk: 156, color: '#ff2040', hint: '刃上长着会动的血刺', desc: '剑脊上生着会动的血刺。拿着它的时候，手心总是热的。' },
};

export const WEAPON_ORDER = ['wood', 'iron', 'frost', 'ember', 'storm', 'blood'];

/** 蓝量自动回复（点/秒，相对原 3.2/s 为 70%） */
export const MP_REGEN_BASE = 3.2;
export const MP_REGEN_PER_SEC = MP_REGEN_BASE * 0.7;

/**
 * 血药：走近地上的瓶子捡起来，进背包。Q 键喝哪一种在背包里选（combat.quickPot）。
 * color / glow 是瓶身和光晕的颜色，地上的掉落物和背包格子共用。
 */
export const POTIONS = {
  hp: { id: 'hp', name: '回血丹', hp: 72, color: '#d63a32', glow: '#ff6a55', hint: '山脚药铺的寻常丹药', desc: '山脚药铺随处可买的丹药。苦，但能把伤口慢慢合上。' },
  hpMid: { id: 'hpMid', name: '凝元丹', hp: 180, color: '#e0942a', glow: '#ffc266', hint: '精怪身上才摸得到', desc: '从精怪身上搜出来的丹药，药力比寻常回血丹厚实一截。' },
  hpBig: { id: 'hpBig', name: '还魂丹', hp: 420, color: '#a04ae0', glow: '#d49bff', hint: '只有大妖才舍得带', desc: '大妖才带在身上的丹药。一口气灌下去，像把人从鬼门关拽回来。' },
};

export const POTION_ORDER = ['hp', 'hpMid', 'hpBig'];

const START_POTS = { hp: 1, hpMid: 0, hpBig: 0 };

export const combat = {
  level: 1,
  xp: 0,
  hp: BASE.hp,
  mp: BASE.mp,
  weapon: 'wood',
  owned: { wood: true },
  pots: { ...START_POTS },
  /** Q 键喝的血药 id，在背包里选 */
  quickPot: 'hp',
  toast: '',
  toastAge: 0,
  dead: false,
  /** 最近一次受伤的闪白，HUD 用 */
  hurt: 0,
  /** 死亡倒地处的血迹 { x, y, z, age } */
  deathStain: null,
  /** 本次死亡已过去的时间（秒），HUD / 复活用 */
  deathAge: 0,
  /** 武来剩余冷却（秒） */
  wulaiCd: 0,
  /** 回旋斩剩余冷却（秒） */
  whirlCd: 0,
  /** 已学会的技能 id。现在开局四种都会，存档会把这份记下来 */
  skills: ['attack', 'skill', 'whirl', 'wulai'],
};

/** 地上的掉落物。Loot.jsx 每帧读这份。 */
export const loot = [];

/** 头顶飘字。FloatTexts.jsx 每帧读这份。 */
export const floats = [];

/** 打击感：镜头震动 / 顿帧 / 人物击退 */
export const fx = {
  shake: 0,
  stop: 0,
  knockX: 0,
  knockZ: 0,
  /** K 砸中时屏幕金闪 */
  skill: 0,
};

let lootUid = 1;
let floatUid = 1;

export function resetCombat() {
  combat.level = 1;
  combat.xp = 0;
  combat.hp = BASE.hp;
  combat.mp = BASE.mp;
  combat.weapon = 'wood';
  combat.owned = { wood: true };
  combat.pots = { ...START_POTS };
  combat.quickPot = 'hp';
  combat.toast = '';
  combat.toastAge = 0;
  combat.dead = false;
  combat.hurt = 0;
  combat.deathStain = null;
  combat.deathAge = 0;
  combat.wulaiCd = 0;
  combat.whirlCd = 0;
  combat.skills = ['attack', 'skill', 'whirl', 'wulai'];
  resetMoves(world);
  world.striking = false;
  world.paused = false;
  fx.shake = 0;
  fx.stop = 0;
  fx.knockX = 0;
  fx.knockZ = 0;
  fx.skill = 0;
  loot.length = 0;
  floats.length = 0;
  spawnMapStarterLoot();
}

/** 西北角固定掉落：「血棘魔剑」，需走近拾取 */
export function spawnMapStarterLoot() {
  if (combat.owned.blood) return;
  if (loot.some((it) => it.id === 'blood')) return;
  spawnLoot(-(HALF - 10), -(HALF - 10), 'blood');
}

export function liveStats() {
  const s = statsAt(combat.level);
  const w = WEAPONS[combat.weapon];
  return {
    ...s,
    atk: s.atk + (w ? w.atk : 0),
    weaponAtk: w ? w.atk : 0,
    weaponName: w ? w.name : '未装备',
    xpNeed: xpToNext(combat.level),
  };
}

/** 伤害：攻 - 防×0.55，至少 1，再抖 15% */
export function rollDamage(atk, def) {
  const raw = atk - def * 0.55;
  return Math.max(1, Math.round(raw * (0.85 + Math.random() * 0.3)));
}

export function gainXp(amount) {
  if (combat.level >= LEVEL_MAX) return;
  combat.xp += amount;
  let up = 0;
  while (combat.level < LEVEL_MAX && combat.xp >= xpToNext(combat.level)) {
    combat.xp -= xpToNext(combat.level);
    combat.level += 1;
    up += 1;
  }
  if (up) {
    const s = statsAt(combat.level);
    combat.hp = s.maxHp;
    combat.mp = s.maxMp;
    combat.toast = up > 1 ? `连升 ${up} 级！现在 ${combat.level} 级` : `升级！${combat.level} 级`;
    combat.toastAge = 3.2;
  }
}

export function takeHit(dmg) {
  if (combat.dead) return;
  const dealt = world.lock || world.move === 'wulai' ? Math.max(1, Math.round(dmg * 0.5)) : dmg;
  combat.hp = Math.max(0, combat.hp - dealt);
  combat.hurt = 0.45;
  spawnFloat(world.x, world.y + 1.72, world.z, `-${dealt}`, '#ff4a3a', 1.15);
  if (world.lock) {
    bang({ shake: 0.1, stop: 0 });
  } else {
    bang({ shake: 0.24, stop: 0.05 });
  }
  if (combat.hp <= 0) {
    combat.dead = true;
    combat.deathAge = 0;
    combat.deathStain = { x: world.x, y: world.y, z: world.z, age: 0 };
    combat.toast = '';
    combat.toastAge = 0;
    resetMoves(world);
    world.lock = false;
    world.striking = false;
    world.move = '';
    world.swing = 0;
    world.heavy = 0;
    bang({ shake: 0.32, stop: 0.08 });
  }
}

export function healTo(frac = 0.55) {
  const s = statsAt(combat.level);
  combat.hp = Math.max(combat.hp, Math.round(s.maxHp * frac));
  combat.mp = Math.max(combat.mp, Math.round(s.maxMp * 0.4));
  combat.dead = false;
  combat.deathAge = 0;
  combat.deathStain = null;
}

export function grantWeapon(id) {
  if (!WEAPONS[id] || combat.owned[id]) return false;
  combat.owned[id] = true;
  combat.toast = `获得 ${WEAPONS[id].name} · 点头像打开背包装备`;
  combat.toastAge = 3.6;
  return true;
}

export function equipWeapon(id) {
  if (!combat.owned[id]) return false;
  combat.weapon = id;
  combat.toast = `装备 ${WEAPONS[id].name}`;
  combat.toastAge = 1.6;
  return true;
}

/** 卸下当前武器。空手时攻击只剩人物底板。 */
export function unequipWeapon() {
  const w = WEAPONS[combat.weapon];
  if (!w) return false;
  combat.weapon = '';
  combat.toast = `卸下 ${w.name}`;
  combat.toastAge = 1.6;
  return true;
}

/**
 * Q 槽里的药没货了，就换成背包里还有的最低一档（先喝便宜的）。
 * 什么药都没有时保持原选择。返回是否换了。
 */
function refillQuickPot() {
  if ((combat.pots[combat.quickPot] || 0) > 0) return false;
  const next = POTION_ORDER.find((id) => (combat.pots[id] || 0) > 0);
  if (!next) return false;
  combat.quickPot = next;
  return true;
}

/** 背包里选 Q 键喝哪种药。没货的不能选。 */
export function setQuickPotion(id) {
  if (!POTIONS[id] || (combat.pots[id] || 0) <= 0) return false;
  combat.quickPot = id;
  combat.toast = `Q 键用药：${POTIONS[id].name}`;
  combat.toastAge = 1.6;
  return true;
}

/** 喝一瓶血药。不传 id 就喝 Q 槽里选的那种。 */
export function usePotion(id = combat.quickPot) {
  const pot = POTIONS[id];
  if (combat.dead || !pot) return false;
  if ((combat.pots[id] || 0) <= 0) return false;
  const s = statsAt(combat.level);
  if (combat.hp >= s.maxHp - 0.5) return false;
  combat.pots[id] -= 1;
  const add = Math.min(pot.hp, s.maxHp - combat.hp);
  combat.hp += add;
  spawnFloat(world.x, world.y + 1.7, world.z, `+${Math.round(add)}`, '#7dff9a', 1.05);
  combat.toast = `喝下${pot.name} +${Math.round(add)}`;
  combat.toastAge = 1.8;
  if (refillQuickPot()) {
    combat.toast += ` · Q 换成${POTIONS[combat.quickPot].name}`;
    combat.toastAge = 2.6;
  }
  return true;
}

export function spawnLoot(x, z, id) {
  loot.push({
    uid: lootUid++,
    id,
    x: x + (Math.random() - 0.5) * 0.7,
    z: z + (Math.random() - 0.5) * 0.7,
    spin: Math.random() * Math.PI * 2,
  });
}

export function rollDrops(table, x, z) {
  if (!table) return;
  for (const [id, p] of Object.entries(table)) {
    if (id === 'mp') continue;
    if (WEAPONS[id] && combat.owned[id]) continue;
    if (Math.random() < p) spawnLoot(x, z, id);
  }
}

const PICK_R = 1.6;

/** 走到掉落物旁边就捡。武器和药都进背包：武器在背包里装备，药在背包里选 Q 键喝哪种。 */
export function tryPickup(x, z) {
  for (let i = loot.length - 1; i >= 0; i--) {
    const it = loot[i];
    if (Math.hypot(it.x - x, it.z - z) > PICK_R) continue;
    loot.splice(i, 1);
    const pot = POTIONS[it.id];
    if (pot) {
      combat.pots[pot.id] = (combat.pots[pot.id] || 0) + 1;
      refillQuickPot();
      combat.toast =
        combat.quickPot === pot.id ? `捡到${pot.name} · 按 Q 使用` : `捡到${pot.name} · 已放进背包`;
      combat.toastAge = 2.6;
    } else if (!grantWeapon(it.id)) {
      combat.toast = '已经有这件武器了';
      combat.toastAge = 1.4;
    }
  }
}

export function spawnFloat(x, y, z, text, color, scale = 1) {
  floats.push({
    uid: floatUid++,
    x,
    y,
    z,
    text,
    color,
    scale,
    age: 0,
    life: 0.92,
    jx: (Math.random() - 0.5) * 0.5,
  });
  if (floats.length > 28) floats.shift();
}

export function bang({ shake = 0.16, stop = 0.04, knockX = 0, knockZ = 0 } = {}) {
  fx.shake = Math.max(fx.shake, shake);
  fx.stop = Math.max(fx.stop, stop);
  fx.knockX += knockX;
  fx.knockZ += knockZ;
}

/** 玩家在世界里的位置，怪物每帧来读。不放进 React。 */
export const world = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  /** 相机绕 Y 的角度；镜头朝 (-sin, 0, -cos)，HUD 指北针用 */
  camYaw: Math.PI,
  air: false,
  /** 当前招式 id，见 combatMoves.MOVES */
  move: '',
  /** 普通 / 连招剩余时间 */
  swing: 0,
  /** K 技能剩余时间 */
  heavy: 0,
  /** 这一刀真正出伤的那一小段 */
  striking: false,
  queued: false,
  combo: 0,
  comboGate: 0,
  /** 旋转攻击的额外朝向（只转模型，不改判定面） */
  spin: 0,
  /** 大招霸体：锁移动 / 普攻 */
  lock: false,
  /** 系统菜单开着：人物、怪物、载具都停在这一帧 */
  paused: false,
  /** 武来冲击波当前半径 */
  waveR: 0,
  /** 这一发大招是否已经砸出深坑 */
  craterArmed: false,
  /** 砸地后留在世界里的岩浆坑 */
  crater: { on: false, x: 0, y: 0, z: 0, r: 6.5, age: 0 },
};

export const SWING_TIME = MOVES.stab.time;
export const HEAVY_TIME = MOVES.skill.time;
export const HEAVY_MP = 14;
export const WHIRL_MP = 16;
/** 回旋斩冷却（秒），移动端与 PC 共用 */
export const WHIRL_CD = 10;
export const WULAI_MP = 28;
/** 大招「武来」冷却（秒），移动端与 PC 共用 */
export const WULAI_CD = 30;
export const HEAVY_MULT = MOVES.skill.mult;
export const WHIRL_MULT = MOVES.whirl.mult;
export const WULAI_MULT = MOVES.wulai.mult;
export const HIT_RANGE = MOVES.stab.range;
export const HEAVY_RANGE = MOVES.skill.range;
export const HIT_CONE = MOVES.stab.cone;
export const HEAVY_CONE = MOVES.skill.cone;
export const STRIKE_START = MOVES.stab.strike[0];
export const STRIKE_END = MOVES.stab.strike[1];
export const HEAVY_STRIKE_START = MOVES.skill.strike[0];
export const HEAVY_STRIKE_END = MOVES.skill.strike[1];
