import { MAP_ENV } from '../maps/huangshan/env';
import { terrainHeight } from '../maps/huangshan/heightfield';
import { syncCarFromPlayer, vehicle } from '../vehicles/runtime';
import { resetMoves } from '../../../lib/animation/combatMoves';
import { drift } from './driftStore';
import { peekPlayerState } from './gameSession';
import {
  LEVEL_MAX,
  POTION_ORDER,
  POTIONS,
  WEAPON_ORDER,
  WEAPONS,
  combat,
  statsAt,
  world,
} from './combatStore';

/** 浏览器本地存档。10 页，每页 10 格，后写的覆盖同一格。 */
export const SAVE_KEY = 'wulai.save.v1';
export const SAVE_PAGE_SIZE = 10;
export const SAVE_PAGES = 10;
export const SAVE_SLOTS = SAVE_PAGE_SIZE * SAVE_PAGES;
const SKILL_IDS = ['attack', 'skill', 'whirl', 'wulai'];

function browserStorage() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function emptyBook() {
  return { version: 1, slots: Array.from({ length: SAVE_SLOTS }, () => null) };
}

function num(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** 丢掉坏档，只留认得的装备、药和技能 */
export function normalizeSlot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const level = clamp(Math.round(num(raw.level, 1)), 1, LEVEL_MAX);
  const stats = statsAt(level);
  const owned = {};
  const srcOwned = raw.owned && typeof raw.owned === 'object' ? raw.owned : {};
  for (const id of WEAPON_ORDER) {
    if (srcOwned[id]) owned[id] = true;
  }
  if (!Object.keys(owned).length) owned.wood = true;
  let weapon = typeof raw.weapon === 'string' ? raw.weapon : 'wood';
  if (weapon && !owned[weapon]) weapon = Object.keys(owned)[0];
  const pots = {};
  const srcPots = raw.pots && typeof raw.pots === 'object' ? raw.pots : {};
  for (const id of POTION_ORDER) pots[id] = clamp(Math.round(num(srcPots[id], 0)), 0, 99);
  let quickPot = POTIONS[raw.quickPot] ? raw.quickPot : 'hp';
  if (!pots[quickPot]) quickPot = POTION_ORDER.find((id) => pots[id] > 0) || 'hp';
  const skills = [];
  const srcSkills = Array.isArray(raw.skills) ? raw.skills : SKILL_IDS;
  for (const id of srcSkills) {
    if (SKILL_IDS.includes(id) && !skills.includes(id)) skills.push(id);
  }
  if (!skills.length) skills.push(...SKILL_IDS);
  const x = clamp(num(raw.x, 0), -400, 400);
  const z = clamp(num(raw.z, 0), -400, 400);
  return {
    savedAt: num(raw.savedAt, Date.now()),
    map: MAP_ENV.id,
    place: MAP_ENV.label,
    level,
    xp: Math.max(0, Math.round(num(raw.xp, 0))),
    hp: clamp(num(raw.hp, stats.maxHp), 1, stats.maxHp),
    mp: clamp(num(raw.mp, stats.maxMp), 0, stats.maxMp),
    weapon,
    owned,
    pots,
    quickPot,
    skills,
    x,
    y: num(raw.y, terrainHeight(x, z)),
    z,
    yaw: num(raw.yaw, Math.PI),
    camYaw: num(raw.camYaw, Math.PI),
    camPitch: clamp(num(raw.camPitch, 0.3), -0.25, 1.15),
    camDist: clamp(num(raw.camDist, 5.2), 2.8, 18),
    inCar: !!raw.inCar,
    nitro: clamp(Math.round(num(raw.nitro, 0)), 0, 3),
    nitroDist: Math.max(0, num(raw.nitroDist, 0)),
  };
}

export function readBook(storage = browserStorage()) {
  if (!storage) return emptyBook();
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY) || 'null');
    const book = emptyBook();
    if (!data || data.version !== 1 || !Array.isArray(data.slots)) return book;
    for (let i = 0; i < SAVE_SLOTS; i++) book.slots[i] = normalizeSlot(data.slots[i]);
    return book;
  } catch {
    return emptyBook();
  }
}

function writeBook(book, storage) {
  storage.setItem(SAVE_KEY, JSON.stringify(book));
}

/** 画面上这个人。菜单暂停后帧循环不再跑，模块里那份记录也可能已经被清掉 */
function livePlayer() {
  if (world.player?.pos) return world.player;
  const peeked = peekPlayerState();
  return peeked?.pos ? peeked : null;
}

/** 把当前人物收成一档。人还没进场景时返回 null */
export function captureSave() {
  const s = livePlayer();
  if (!s) return null;
  const stats = statsAt(combat.level);
  return normalizeSlot({
    savedAt: Date.now(),
    level: combat.level,
    xp: combat.xp,
    hp: combat.dead ? 1 : combat.hp,
    mp: combat.mp,
    weapon: combat.weapon,
    owned: combat.owned,
    pots: combat.pots,
    quickPot: combat.quickPot,
    skills: combat.skills,
    x: s.pos.x,
    y: s.pos.y,
    z: s.pos.z,
    yaw: s.yaw,
    camYaw: s.camYaw,
    camPitch: s.camPitch,
    camDist: s.camDist,
    inCar: vehicle.inCar,
    nitro: drift.nitro,
    nitroDist: drift.dist,
    maxHp: stats.maxHp,
    maxMp: stats.maxMp,
  });
}

function putVec(obj, x, y, z) {
  if (!obj) return;
  if (typeof obj.set === 'function') obj.set(x, y, z);
  else {
    obj.x = x;
    obj.y = y;
    obj.z = z;
  }
}

/** 把一档写回正在玩的这局。菜单还开着，暂停标志不动 */
export function applySave(slot) {
  const data = normalizeSlot(slot);
  const s = livePlayer();
  if (!data || !s) return false;
  combat.level = data.level;
  combat.xp = data.xp;
  combat.hp = data.hp;
  combat.mp = data.mp;
  combat.weapon = data.weapon;
  combat.owned = { ...data.owned };
  combat.pots = { ...data.pots };
  combat.quickPot = data.quickPot;
  combat.skills = data.skills.slice();
  combat.dead = false;
  combat.deathAge = 0;
  combat.deathStain = null;
  combat.wulaiCd = 0;
  combat.whirlCd = 0;
  combat.toast = `读档 · ${data.place} · ${data.level} 级`;
  combat.toastAge = 2.4;
  drift.nitro = data.nitro;
  drift.dist = data.nitroDist;
  drift.progress = 0;
  drift.boost = 0;
  drift.air = false;
  putVec(s.pos, data.x, data.y, data.z);
  putVec(s.vel, 0, 0, 0);
  putVec(s.knock, 0, 0, 0);
  s.yaw = data.yaw;
  s.camYaw = data.camYaw;
  s.camPitch = data.camPitch;
  s.camDist = data.camDist;
  s.camEyeY = data.y + (data.inCar ? 1.15 : 1.3);
  s.vy = 0;
  s.air = false;
  s.charging = false;
  s.charge = 0;
  s.wantJump = false;
  s.steer = 0;
  vehicle.driveSpeed = 0;
  if (data.inCar) {
    vehicle.inCar = true;
    syncCarFromPlayer(s);
  } else {
    vehicle.inCar = false;
  }
  world.x = data.x;
  world.y = data.y;
  world.z = data.z;
  world.yaw = data.yaw;
  world.camYaw = data.camYaw;
  world.air = false;
  resetMoves(world);
  return true;
}

export function saveToSlot(index, storage = browserStorage()) {
  if (!storage || index < 0 || index >= SAVE_SLOTS) return { ok: false, reason: '档位不对' };
  const slot = captureSave();
  if (!slot) return { ok: false, reason: '人物还没就绪' };
  const book = readBook(storage);
  const overwrite = !!book.slots[index];
  book.slots[index] = slot;
  try {
    writeBook(book, storage);
  } catch {
    return { ok: false, reason: '写不进本地存档' };
  }
  combat.toast = overwrite ? `已覆盖存档 ${index + 1}` : `已存到存档 ${index + 1}`;
  combat.toastAge = 2.2;
  return { ok: true, overwrite, slot };
}

export function loadSlot(index, storage = browserStorage()) {
  if (!storage || index < 0 || index >= SAVE_SLOTS) return { ok: false, reason: '档位不对' };
  const slot = readBook(storage).slots[index];
  if (!slot) return { ok: false, reason: '这是空档' };
  if (!applySave(slot)) return { ok: false, reason: '人物还没就绪' };
  return { ok: true, slot };
}
