import * as THREE from 'three';
import { mulberry32 } from '../../lib/math/random';
import { craterHit, hitTest, moveOf, MOVES } from '../../lib/animation/combatMoves';
import {
  bang,
  combat,
  fx,
  gainXp,
  liveStats,
  rollDamage,
  rollDrops,
  spawnFloat,
  takeHit,
  world,
} from './combatStore';
import { HALF, terrainHeight } from './heightfield';
import { MONSTER_KINDS } from './monsterKinds';
import { pickSpot } from './monsterPack';

export const DEATH_FADE = 3;
const HP_BAR_DIST = 42;
const FAR_SIM = 78;

const _axis = new THREE.Vector3(0, 1, 0);
const _look = new THREE.Quaternion();

export function paintBody(root, { gray, opacity }) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) {
      if (gray) {
        if (!mat.userData.liveColor) mat.userData.liveColor = mat.color.clone();
        mat.color.set('#8a8a8a');
        mat.transparent = true;
        mat.opacity = opacity;
        mat.depthWrite = opacity > 0.92;
      } else if (mat.userData.liveColor) {
        mat.color.copy(mat.userData.liveColor);
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthWrite = true;
      }
    }
  });
}

/**
 * 单怪一帧（由 Monsters 根组件统一调用，避免 100+ 个 useFrame）
 * @param refs {{ group, body, bar, fill }} 可能尚未 mount
 */
export function tickMonster(m, refs, { dt, dtRaw, camera, frame }) {
  const group = refs.group?.current;
  const body = refs.body?.current;
  const bar = refs.bar?.current;
  const fill = refs.fill?.current;
  const spec = MONSTER_KINDS[m.kind];
  const px = world.x;
  const pz = world.z;
  const dist = Math.hypot(px - m.x, pz - m.z);

  if (m.dead) {
    m.respawn -= dtRaw;
    m.fade = Math.max(0, (m.fade || 0) - dtRaw);
    const k = m.fade / DEATH_FADE;
    if (group) {
      group.visible = k > 0.01;
      group.position.set(m.x, m.y, m.z);
    }
    if (body) {
      paintBody(body, { gray: true, opacity: k });
      body.scale.setScalar(1);
      body.rotation.z = 0;
    }
    if (bar) bar.visible = false;
    if (m.respawn <= 0) {
      const rnd = mulberry32((m.id + 1) * 9973 + Math.floor(performance.now()) % 99991);
      const p = pickSpot(rnd, spec.zone);
      m.x = p.x;
      m.z = p.z;
      m.y = p.y;
      m.homeX = p.x;
      m.homeZ = p.z;
      m.hp = spec.hp;
      m.dead = false;
      m.fade = 0;
      m.cd = 1;
      m.hurt = 0;
      m.hitLock = 0;
      m.burnLock = 0;
      paintBody(body, { gray: false, opacity: 1 });
      if (group) group.visible = true;
    }
    return;
  }

  if (group) group.visible = true;

  const far = dist > FAR_SIM;
  if (far) {
    if (group) {
      group.position.set(m.x, m.y, m.z);
      _look.setFromAxisAngle(_axis, m.yaw);
      group.quaternion.copy(_look);
    }
    if (bar) bar.visible = false;
    if (frame % 4 !== m.id % 4) return;
  }

  m.cd = Math.max(0, m.cd - dt);
  m.hurt = Math.max(0, m.hurt - dtRaw * 2.4);

  if (!far) {
    const mv = moveOf(world.move || (world.heavy > 0 ? 'skill' : 'stab'));
    const bodyR = (spec.radius || 0.5) * spec.scale;
    if (m.hitLock <= 0 && hitTest(world, m.x, m.z, bodyR)) {
      const me = liveStats();
      const dmg = rollDamage(me.atk * mv.mult, spec.def);
      m.hp -= dmg;
      m.hurt = world.move === 'whirl' ? 0.34 : mv.mult >= 1.5 ? 0.5 : 0.36;
      m.hitLock = mv.hitLock;
      spawnFloat(m.x, m.y + 1.55 * spec.scale, m.z, `-${dmg}`, mv.color, mv.mult >= 1.5 ? 1.35 : 1.08);
      bang({
        shake: world.move === 'whirl' ? 0.18 : 0.2 + mv.mult * 0.1,
        stop: world.move === 'wulai' ? 0 : world.move === 'whirl' ? 0.022 : 0.05 + mv.mult * 0.025,
      });
      if (world.move === 'whirl') fx.skill = Math.max(fx.skill, 0.1);
      if (m.hp <= 0) {
        m.dead = true;
        m.fade = DEATH_FADE;
        m.respawn = 16 + Math.random() * 14;
        paintBody(body, { gray: true, opacity: 1 });
        gainXp(spec.xp);
        rollDrops(spec.drop, m.x, m.z);
        return;
      }
    }
    m.hitLock = Math.max(0, m.hitLock - dt);
    m.burnLock = Math.max(0, (m.burnLock || 0) - dt);
    if (m.hp > 0 && m.burnLock <= 0 && craterHit(world, m.x, m.z, bodyR)) {
      const pit = MOVES.wulai;
      const me = liveStats();
      const dmg = rollDamage(me.atk * (pit.craterMult || 0.5), spec.def);
      m.hp -= dmg;
      m.hurt = 0.28;
      m.burnLock = pit.craterTick || 0.5;
      spawnFloat(m.x, m.y + 1.45 * spec.scale, m.z, `-${dmg}`, '#ff4a12', 0.95);
      if (m.hp <= 0) {
        m.dead = true;
        m.fade = DEATH_FADE;
        m.respawn = 16 + Math.random() * 14;
        paintBody(body, { gray: true, opacity: 1 });
        gainXp(spec.xp);
        rollDrops(spec.drop, m.x, m.z);
        return;
      }
    }
  }

  let tx = 0;
  let tz = 0;
  if (dist < spec.aggro && !combat.dead) {
    tx = px - m.x;
    tz = pz - m.z;
    if (dist < spec.range && m.cd <= 0) {
      const dmg = rollDamage(spec.atk, liveStats().def);
      const nx = tx / Math.max(dist, 0.2);
      const nz = tz / Math.max(dist, 0.2);
      takeHit(dmg);
      if (!world.lock) bang({ knockX: nx * 6.4, knockZ: nz * 6.4 });
      m.cd = spec.cd;
    }
  } else {
    m.wander -= dt;
    if (m.wander <= 0) {
      m.wx = (Math.random() * 2 - 1) * 5;
      m.wz = (Math.random() * 2 - 1) * 5;
      m.wander = 1.4 + Math.random() * 2.2;
    }
    tx = m.wx;
    tz = m.wz;
    const [lo, hi] = spec.zone.height;
    if (m.y < lo + 0.4 || m.y > hi - 0.4 || Math.hypot(m.x - m.homeX, m.z - m.homeZ) > 14) {
      tx = m.homeX - m.x;
      tz = m.homeZ - m.z;
    }
  }
  const len = Math.hypot(tx, tz);
  if (len > 0.15 && dist > spec.range * 0.85) {
    const step = spec.speed * dt;
    m.x += (tx / len) * step;
    m.z += (tz / len) * step;
    m.yaw = Math.atan2(tx, tz);
  }
  const limit = HALF - 6;
  m.x = THREE.MathUtils.clamp(m.x, -limit, limit);
  m.z = THREE.MathUtils.clamp(m.z, -limit, limit);
  m.y = terrainHeight(m.x, m.z);

  if (group) {
    group.position.set(m.x, m.y, m.z);
    _look.setFromAxisAngle(_axis, m.yaw);
    group.quaternion.slerp(_look, 1 - Math.exp(-8 * dt));
  }
  if (body) {
    const punch = 1 + m.hurt * 1.15;
    body.scale.setScalar(punch);
    body.rotation.z = Math.sin(m.hurt * 22) * 0.28;
  }

  const showBar = dist < HP_BAR_DIST;
  if (bar) {
    bar.visible = showBar;
    if (showBar && camera) bar.lookAt(camera.position);
  }
  if (showBar && fill) {
    const t = Math.max(0, m.hp / spec.hp);
    fill.scale.x = Math.max(0.001, t);
    fill.position.x = -(0.7 * (1 - t)) / 2;
    fill.material.color.set(t > 0.35 ? '#e0543a' : '#ffcc44');
  }
}
