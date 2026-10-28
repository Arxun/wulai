import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { moveOf, movePose, moveProgress, tickMoves, tryLightAttack, trySkill, tryWhirl, tryWulai } from '../../lib/animation/combatMoves';
import { RUN_SPEED, WALK_SPEED, ZERO_POSE, blendPose, gaitParams, gaitPose, jumpPose } from '../../lib/animation/gait';
import { moveAxis, useKeyboard } from '../../lib/hooks/useKeyboard';
import Person from '../lowpoly/person/index';
import { LOCO_RIG } from '../lowpoly/person/rigs';
import AttackFx from './AttackFx';
import HeavySkillFx from './HeavySkillFx';
import NitroFlame from './NitroFlame';
import WhirlFx from './WhirlFx';
import WulaiUlt from './WulaiUlt';
import {
  BOOST_MULT,
  BOOST_TIME,
  DRIFT_MIN_SPEED,
  DRIFT_SLIP,
  NITRO_COST,
  NITRO_MAX,
  drift,
  resetDrift,
} from './driftStore';
import {
  HEAVY_MP,
  HEAVY_TIME,
  WHIRL_MP,
  WULAI_MP,
  WEAPON_ORDER,
  combat,
  equipWeapon,
  fx,
  healTo,
  resetCombat,
  statsAt,
  tryPickup,
  usePotion,
  world,
} from './combatStore';
import { ULT_SKILL_NAME } from '../../config/lore';
import { HALF, SPAWN, terrainHeight, terrainNormal } from './heightfield';
import {
  CAR_SIT_POSE,
  enterSu7,
  START_IN_SU7,
  syncPlayerToSeat,
  toggleSu7Entry,
  updateCarProximity,
  vehicle,
} from './vehicleStore';
import { resolvePlayerObstacles } from './worldObstacles';

/**
 * 主角「小武」：键盘走跑 + 漂移攒氮气 + 第三人称跟随相机。
 *
 * 操作：
 *  - WASD / 方向键按相机朝向移动，**长按就会越跑越快**（不需要加速键）；
 *  - 跑起来之后按住 Shift，点一下左右 → 漂移（方向锁住，只按 Shift 也能一直绕圈），
 *    留下鞋底摩擦印子，攒够距离得一瓶氮气；
 *  - Ctrl 放氮气：3 秒内速度 ×3，屁股后面喷火 + 速度线。放的时候不能叠加。
 *  - 空格跳跃：点按小跳，长按最多 2 秒蓄力，松手跳；蓄满最高是身高的 5 倍。
 *    跑起来再跳会带着水平速度，所以跳得更远。
 *  - 连按 J：刺 → 劈 → 砍 → 旋；空中 J 下砸 ×1.5；E 回旋斩（可移动）；K 崩击；L 大招「武来」。
 *    Q 回血、W 回蓝。招式表在 lib/animation/combatMoves.js。数字 1–5 换已获得的武器。
 *
 * 几个关键点：
 *  - 步态相位按**走过的距离**累加（见 lib/animation/gait.js），所以脚不会在地上打滑；
 *  - 姿态写进 poseRef 这个可变对象，Person 在自己的 useFrame 里读它改关节旋转，
 *    整个过程没有 setState，不会每帧触发 React 重渲染；
 *  - 漂移 / 氮气的数值写进 driftStore 单例，右上角 HUD 定时去读；
 *  - 主光挂在玩家身上（跟着走），阴影贴图才能一直罩住人物附近，不然要么糊要么没影子。
 */

const UP = new THREE.Vector3(0, 1, 0);
const START = SPAWN;
const { clamp, lerp, smoothstep } = THREE.MathUtils;

/** 每隔这么远盖一个鞋印（印子本身比这个长，所以会连成一条） */
const SKID_STEP = 0.26;
/** 漂移时的打舵速度（弧度/秒）。它和下面的抓地力一起决定侧滑角：slip ≈ 打舵 / 抓地 */
const DRIFT_TURN = 2.3;
const DRIFT_GRIP = 2.8;
/** 步频上限（周期/秒）：氮气那三秒速度远超腿能迈的范围，不封顶腿会变成一团糊影 */
const MAX_CADENCE = 3.4;
/** 人物身高（米）。蓄满跳 = 5 倍身高 */
const PERSON_H = 1.78;
const JUMP_CHARGE_TIME = 2;
const JUMP_H_MIN = 1.15;
const JUMP_H_MAX = PERSON_H * 5;
const JUMP_GRAVITY = 26;
const JUMP_LAND = 0.22;

/** 带环绕处理的角度插值（避免从 +179° 转到 -179° 时绕一大圈） */
function approachAngle(cur, target, t) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * t;
}

/** 把角度差折到 -π~π */
function wrapAngle(d) {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export default function Player({ lightRef, skidRef, lineRef }) {
  // 氮气在 keydown 那一下就判定：短按一下有可能整个夹在两帧之间，轮询会漏
  const keys = useKeyboard(
    (code) => {
      if (code === 'ControlLeft' || code === 'ControlRight') {
        if (drift.nitro > 0 && drift.boost <= 0) {
          drift.nitro -= 1;
          drift.boost = BOOST_TIME;
        }
        return;
      }
      // 落地才开始蓄力；空中再按空格不打断当前这一跳
      if (code === 'KeyF') {
        if (!toggleSu7Entry(world.x, world.z, s) && !vehicle.inCar) {
          combat.toast = '靠近 SU7 后再按 F';
          combat.toastAge = 1.4;
        }
        return;
      }
      if (world.lock || vehicle.inCar) return;
      if (code === 'Space' && !s.air) {
        s.charging = true;
        s.charge = 0;
        return;
      }
      if (combat.dead) return;
      if (code === 'KeyQ') {
        usePotion('hp');
        return;
      }
      if (code === 'KeyW') {
        usePotion('mp');
        return;
      }
      if (code === 'KeyE') {
        if (combat.mp < WHIRL_MP) {
          combat.toast = `蓝不够 · 回旋斩需要 ${WHIRL_MP}`;
          combat.toastAge = 1.4;
          return;
        }
        if (tryWhirl(world)) combat.mp -= WHIRL_MP;
        return;
      }
      if (code === 'KeyJ') {
        tryLightAttack(world, { air: s.air });
        return;
      }
      if (code === 'KeyK') {
        if (combat.mp < HEAVY_MP) return;
        if (trySkill(world)) combat.mp -= HEAVY_MP;
        return;
      }
      if (code === 'KeyL') {
        if (combat.mp < WULAI_MP) {
          combat.toast = `蓝不够 · ${ULT_SKILL_NAME}需要 ${WULAI_MP}`;
          combat.toastAge = 1.6;
          return;
        }
        if (tryWulai(world)) {
          combat.mp -= WULAI_MP;
          fx.skill = 0.2;
          fx.shake = Math.max(fx.shake, 0.2);
        }
        return;
      }
      const digit = code.startsWith('Digit') || code.startsWith('Numpad') ? Number(code.slice(-1)) : 0;
      if (digit >= 1 && digit <= WEAPON_ORDER.length) equipWeapon(WEAPON_ORDER[digit - 1]);
    },
    (code) => {
      if (code === 'Space' && !world.lock) s.wantJump = true;
    },
  );
  const group = useRef();
  const fxWrap = useRef();
  const poseRef = useRef(ZERO_POSE);
  const flameRef = useRef(drift);
  const { camera, gl } = useThree();

  vehicle.poseRef = poseRef;

  const sRef = useRef(null);
  if (!sRef.current) {
    sRef.current = {
    pos: new THREE.Vector3(START[0], terrainHeight(START[0], START[1]), START[1]),
    vel: new THREE.Vector3(),
    yaw: Math.PI,
    phase: 0,
    camYaw: Math.PI,
    camPitch: 0.3,
    camDist: 5.2,
    dragging: false,
    turn: 0,
    hold: 0, // 方向键已按住多久 → 加速
    runMix: 0,
    slip: 0, // 侧滑角：身体朝向和速度方向的夹角
    skid: 0, // 距上一个鞋印走了多远
    steer: 0, // 漂移打舵：-1 左 / +1 右。按住 Shift 会锁住，松手才清掉
    baseFov: 0,
    vy: 0,
    air: false,
    charging: false,
    charge: 0,
    wantJump: false,
    launch: 0,
    land: 0,
    respawn: 0,
    skillFlashed: false,
    lunged: false,
    knock: new THREE.Vector3(),
    };
    if (START_IN_SU7) {
      enterSu7(sRef.current);
      sRef.current.camYaw = sRef.current.yaw;
    }
  }
  const s = sRef.current;

  useEffect(() => {
    resetDrift();
    resetCombat();
    if (START_IN_SU7) enterSu7(s);
    else {
      vehicle.inCar = false;
      vehicle.near = false;
    }
    return () => {
      resetDrift();
      resetCombat();
      vehicle.inCar = false;
      vehicle.near = false;
    };
  }, [s]);

  // 鼠标拖动转视角 + 滚轮缩放
  useEffect(() => {
    const el = gl.domElement;
    const down = (e) => {
      s.dragging = true;
      el.setPointerCapture?.(e.pointerId);
    };
    const up = (e) => {
      s.dragging = false;
      el.releasePointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!s.dragging) return;
      s.camYaw -= e.movementX * 0.005;
      s.camPitch = clamp(s.camPitch + e.movementY * 0.004, -0.25, 1.15);
    };
    const wheel = (e) => {
      e.preventDefault();
      s.camDist = clamp(s.camDist * (1 + Math.sign(e.deltaY) * 0.12), 2.8, 18);
    };
    const loseDrag = () => {
      s.dragging = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointermove', move);
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('blur', loseDrag);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', loseDrag);
    };
  }, [gl, s]);

  const tmp = useRef({
    fwd: new THREE.Vector3(),
    right: new THREE.Vector3(),
    want: new THREE.Vector3(),
    target: new THREE.Vector3(),
    camPos: new THREE.Vector3(),
    mark: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    tilt: new THREE.Quaternion(),
    spin: new THREE.Quaternion(),
  }).current;

  useFrame((state, dtRaw) => {
    if (fx.stop > 0) fx.stop = Math.max(0, fx.stop - dtRaw);
    const dt = Math.min(dtRaw, 0.05) * (fx.stop > 0 && !world.lock ? 0.14 : 1);
    updateCarProximity(s.pos.x, s.pos.z);

    const inCar = vehicle.inCar;
    if (inCar && fxWrap.current) fxWrap.current.visible = false;
    else if (fxWrap.current) fxWrap.current.visible = true;

    let { x: ix, y: iy, drift: driftKey } = moveAxis(keys.current);
    if (combat.dead || world.lock || inCar) {
      ix = 0;
      iy = 0;
      driftKey = false;
    }

    // ---- 氮气倒计时（触发在上面的 onPress 里）----
    if (drift.boost > 0) drift.boost = Math.max(0, drift.boost - dt);
    const boosting = drift.boost > 0;

    if (!inCar) tickMoves(world, dt);
    if (world.move === 'skill' && world.striking && !s.skillFlashed) {
      s.skillFlashed = true;
      fx.skill = 0.24;
      fx.shake = Math.max(fx.shake, 0.38);
    }
    if (world.move === 'wulai' && world.striking && !s.skillFlashed) {
      s.skillFlashed = true;
      fx.skill = 0.28;
      fx.shake = Math.max(fx.shake, 0.48);
    }
    if (world.heavy <= 0 && world.move !== 'skill') s.skillFlashed = false;

    const mv = world.move ? moveOf(world.move) : null;
    if (!inCar && mv?.lunge && !s.lunged && world.swing > 0) {
      s.vel.x += Math.sin(s.yaw) * mv.lunge;
      s.vel.z += Math.cos(s.yaw) * mv.lunge;
      s.lunged = true;
    }
    if (world.swing <= 0) s.lunged = false;
    if (mv?.drop && s.air && moveProgress(world) > 0.22) {
      s.vy = Math.min(s.vy, -mv.drop);
    }
    if (fx.skill > 0) fx.skill = Math.max(0, fx.skill - dtRaw);
    if (combat.hurt > 0) combat.hurt = Math.max(0, combat.hurt - dtRaw);
    if (combat.toastAge > 0) combat.toastAge = Math.max(0, combat.toastAge - dt);
    if (!combat.dead) {
      const st = statsAt(combat.level);
      combat.mp = Math.min(st.maxMp, combat.mp + dt * 3.2);
    } else {
      s.respawn += dt;
      if (s.respawn > 1.4) {
        const ry = terrainHeight(START[0], START[1]);
        s.pos.set(START[0], ry, START[1]);
        s.vel.set(0, 0, 0);
        s.knock.set(0, 0, 0);
        s.vy = 0;
        s.air = false;
        s.charging = false;
        s.charge = 0;
        healTo(0.55);
        s.respawn = 0;
      }
    }

    // ---- 目标速度：氮气 ×3 ----
    tmp.fwd.set(-Math.sin(s.camYaw), 0, -Math.cos(s.camYaw)).normalize();
    tmp.right.set(-tmp.fwd.z, 0, tmp.fwd.x);
    tmp.want.set(0, 0, 0).addScaledVector(tmp.fwd, iy).addScaledVector(tmp.right, ix);
    const moving = tmp.want.lengthSq() > 1e-4;

    const prevSpeed = Math.hypot(s.vel.x, s.vel.z);

    // ---- 跳跃：按下 / 松开走键盘回调（点按不会被帧间隔吃掉），这里只负责蓄力和起跳。
    if (!inCar && s.charging && !s.air && !s.wantJump) {
      s.charge = clamp(s.charge + dt / JUMP_CHARGE_TIME, 0, 1);
    }
    if (!inCar && s.wantJump) {
      if (s.charging && !s.air) {
        const h = lerp(JUMP_H_MIN, JUMP_H_MAX, s.charge);
        s.vy = Math.sqrt(2 * JUMP_GRAVITY * h);
        s.air = true;
        s.launch = 1;
        s.land = 0;
        // 跑跳：当前水平速度整段带进空中，再按奔跑程度往前送一截。
        // 空中不再往地面跑速上拽，所以不会边跑边跳还越跳越慢。
        const runK = smoothstep(prevSpeed, 0.6, RUN_SPEED);
        // 边跑边蓄：蓄得越满，起跳往前送得越多，所以比点按跑跳更远
        const boost = (3.4 + 8.5 * s.charge) * runK;
        if (boost > 0.01) {
          s.vel.x += Math.sin(s.yaw) * boost;
          s.vel.z += Math.cos(s.yaw) * boost;
        }
      }
      s.charging = false;
      s.charge = 0;
      s.wantJump = false;
    }
    if (s.air) s.charging = false;
    drift.jumpCharge = s.charging ? s.charge : 0;
    drift.air = s.air;
    if (s.launch > 0) s.launch = Math.max(0, s.launch - dt / 0.07);
    if (s.land > 0) s.land = Math.max(0, s.land - dt / JUMP_LAND);

    // ---- 漂移：跑起来后按住 Shift，点一下左右就把方向锁住。
    // 之后只按着 Shift 也会持续打舵绕圈；松 Shift 或速度掉下去才结束。
    // 换边（A ↔ D）会立刻改锁。左右符号：yaw -= ix，和走路往哪边拐一致。
    // 空中 / 蓄力时不打舵，不然蹲着还能甩尾。
    if (driftKey && !s.air && !s.charging && prevSpeed > DRIFT_MIN_SPEED) {
      if (ix !== 0) s.steer = Math.sign(ix);
    } else if (s.air || !driftKey) {
      s.steer = 0;
    }
    const drifting = s.steer !== 0;

    // 空中 / 跑着蓄力都把奔跑状态冻住，不会被当成松手而掉速
    s.hold = moving || drifting || s.air || (s.charging && prevSpeed > 0.5) ? s.hold + dt : 0;
    const holdRun = smoothstep(s.hold, 0.15, 1.1); // 按住约 1 秒加到全速
    s.runMix = Math.max(holdRun, boosting ? 1 : 0);
    // 站着蓄力才会越蹲越慢；边跑边蓄保持原速，松手才能跳得更远
    const plant = s.charging && !s.air && prevSpeed < 0.8 && !moving ? 1 - 0.82 * s.charge : 1;
    const topSpeed =
      lerp(WALK_SPEED, RUN_SPEED, s.runMix) * (boosting ? BOOST_MULT : 1) * plant;

    if (s.air) {
      // 空中：水平速度原样带着走。还按着方向的话只转朝向，不改快慢。
    } else if (drifting) {
      // 每帧按锁住的方向转身体。速度跟不上 → 侧滑角一直在，就能一直漂。
      s.yaw -= s.steer * DRIFT_TURN * dt;
      tmp.want.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)).multiplyScalar(topSpeed);
    } else if (moving) {
      tmp.want.normalize().multiplyScalar(topSpeed);
    } else if (boosting) {
      // 喷氮气时松手也会被推着往前冲
      tmp.want.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)).multiplyScalar(topSpeed);
    }

    if (s.air) {
      if (moving) {
        const mag = Math.hypot(s.vel.x, s.vel.z);
        if (mag > 0.05) {
          tmp.want.normalize();
          const k = 1 - Math.exp(-3.2 * dt);
          s.vel.x = lerp(s.vel.x, tmp.want.x * mag, k);
          s.vel.z = lerp(s.vel.z, tmp.want.z * mag, k);
        }
      }
    } else {
      const grip = drifting ? DRIFT_GRIP : boosting ? 16 : moving ? 11 : 13;
      s.vel.lerp(tmp.want, 1 - Math.exp(-grip * dt));
    }
    // 击退单独滑，不写进 vel，不然朝向会跟着速度转过去、背对怪物
    if (fx.knockX || fx.knockZ) {
      s.knock.x += fx.knockX;
      s.knock.z += fx.knockZ;
      fx.knockX = 0;
      fx.knockZ = 0;
    }
    const knockFade = Math.exp(-7.5 * dt);
    s.knock.x *= knockFade;
    s.knock.z *= knockFade;
    if (s.knock.lengthSq() < 0.04) s.knock.set(0, 0, 0);
    if (s.vel.lengthSq() < 1e-5) s.vel.set(0, 0, 0);

    const speed = Math.hypot(s.vel.x, s.vel.z);
    drift.speed = speed;
    s.pos.x += (s.vel.x + s.knock.x) * dt;
    s.pos.z += (s.vel.z + s.knock.z) * dt;
    const limit = HALF - 5;
    s.pos.x = clamp(s.pos.x, -limit, limit);
    s.pos.z = clamp(s.pos.z, -limit, limit);

    const col = inCar ? { hit: false } : resolvePlayerObstacles(s.pos.x, s.pos.z);
    if (col.hit) {
      s.pos.x = col.x;
      s.pos.z = col.z;
      const into = s.vel.x * col.nx + s.vel.z * col.nz;
      if (into < 0) {
        s.vel.x -= into * col.nx;
        s.vel.z -= into * col.nz;
      }
      const kIn = s.knock.x * col.nx + s.knock.z * col.nz;
      if (kIn < 0) {
        s.knock.x -= kIn * col.nx;
        s.knock.z -= kIn * col.nz;
      }
    }

    const ground = terrainHeight(s.pos.x, s.pos.z);
    if (inCar) {
      syncPlayerToSeat(s);
      s.pos.y = terrainHeight(s.pos.x, s.pos.z);
      s.vel.set(0, 0, 0);
    } else if (s.air) {
      s.vy -= JUMP_GRAVITY * dt;
      s.pos.y += s.vy * dt;
      if (s.pos.y <= ground && s.vy <= 0) {
        s.pos.y = ground;
        s.vy = 0;
        s.air = false;
        s.land = 1;
        drift.air = false;
      }
    } else {
      s.pos.y = ground;
      s.vy = 0;
    }

    // ---- 朝向：只跟自己按的方向转。击退是往后滑，脸还对着原来那边，才能连砍。
    const velYaw = speed > 0.3 ? Math.atan2(s.vel.x, s.vel.z) : s.yaw;
    const prevYaw = s.yaw;
    if (!drifting && moving) {
      s.yaw = approachAngle(s.yaw, Math.atan2(tmp.want.x, tmp.want.z), 1 - Math.exp(-11 * dt));
    }
    s.slip = speed > 0.3 ? wrapAngle(velYaw - s.yaw) : 0;

    const turnRate = wrapAngle(s.yaw - prevYaw) / Math.max(dt, 1e-3);
    // 漂移时身体往内侧倾，普通转弯只是轻微侧倾
    s.turn = lerp(s.turn, drifting ? clamp(-s.slip * 2.2, -1, 1) : clamp(turnRate / 3, -1, 1), 0.2);

    // ---- 漂移计量 + 盖鞋印 ----
    const sliding = drifting && Math.abs(s.slip) > DRIFT_SLIP && speed > DRIFT_MIN_SPEED;
    drift.sliding = sliding;
    if (sliding) {
      const d = speed * dt;
      drift.dist += d;
      drift.combo += d;
      drift.total += d;
      while (drift.dist >= NITRO_COST && drift.nitro < NITRO_MAX) {
        drift.dist -= NITRO_COST;
        drift.nitro += 1;
      }
      if (drift.nitro >= NITRO_MAX) drift.dist = Math.min(drift.dist, NITRO_COST);
      drift.progress = clamp(drift.dist / NITRO_COST, 0, 1);

      // 左右脚各盖一道，摩擦强度看侧滑角
      s.skid += d;
      const strength = clamp((Math.abs(s.slip) - DRIFT_SLIP) / 0.9, 0, 1);
      const rx = Math.cos(s.yaw);
      const rz = -Math.sin(s.yaw);
      while (s.skid >= SKID_STEP) {
        s.skid -= SKID_STEP;
        const half = 0.11;
        for (const side of [-half, half]) {
          tmp.mark.set(s.pos.x + rx * side, 0, s.pos.z + rz * side);
          tmp.mark.y = terrainHeight(tmp.mark.x, tmp.mark.z) + 0.035;
          tmp.normal.copy(terrainNormal(tmp.mark.x, tmp.mark.z, 0.7));
          skidRef?.current?.emit(tmp.mark, velYaw, tmp.normal, strength);
        }
      }
    } else {
      drift.combo = 0;
      s.skid = 0;
    }

    // ---- 步态 / 跳跃动作 ----
    if (inCar) poseRef.current = CAR_SIT_POSE;

    const g = gaitParams(speed, s.runMix);
    // 空中不再迈步，相位冻住；地上还是按走过的距离推进
    if (!inCar && !s.air) s.phase = (s.phase + Math.min(speed / g.stride, MAX_CADENCE) * dt) % 1;
    const loco = gaitPose({
      phase: s.phase,
      // 空中才停步；跑着蓄力还要继续迈腿，不然看起来像刹住了
      speed: s.air ? 0 : boosting ? Math.min(speed, RUN_SPEED) : speed,
      time: state.clock.elapsedTime,
      turn: s.turn,
      runMix: s.runMix,
    });
    const jumping = !inCar && (s.charging || s.air || s.land > 0);
    if (!inCar && jumping) {
      const jp = jumpPose({
        charge: s.charge,
        air: s.air ? 1 : 0,
        vy: s.vy,
        land: s.land,
        launch: s.launch,
      });
      // 腾空整段用跳姿；跑着蓄力只叠一点下蹲，走跑循环还在
      const k = s.air ? 1 : s.charging ? (speed > 1 ? 0.28 + 0.22 * s.charge : 1) : s.land;
      poseRef.current = blendPose(loco, jp, k);
    } else if (!inCar) {
      poseRef.current = loco;
    }
    if (!inCar && (world.swing > 0 || world.heavy > 0)) {
      const t = moveProgress(world);
      if (world.move === 'whirl') {
        const atk = movePose('whirl', t);
        const mixed = blendPose(poseRef.current, atk, 0.82);
        mixed.legs = poseRef.current.legs;
        mixed.bodyY = poseRef.current.bodyY;
        mixed.lean = 0;
        mixed.roll = 0;
        mixed.twist = atk.twist;
        poseRef.current = mixed;
      } else {
        poseRef.current = blendPose(poseRef.current, movePose(world.move, t), 1);
      }
    }

    if (group.current) {
      group.current.scale.setScalar(1);
      group.current.visible = true;
      group.current.position.copy(s.pos);
      if (inCar) {
        group.current.quaternion.setFromAxisAngle(UP, s.yaw);
      } else {
        // 朝向 + 贴合坡面：先绕 Y 转到朝向，再把"上"方向倒向地表法线（只倒一部分，不然陡坡上人会躺下去）
        // 空中少贴坡，不然跳起来还会跟着地面拧
        const whirl = world.move === 'whirl' && world.swing > 0;
        // 回旋斩只绕竖直轴转，贴坡会把光影拧上下甩；这段站直
        const n = whirl
          ? UP
          : terrainNormal(s.pos.x, s.pos.z, 0.9).lerp(UP, s.air ? 0.85 : 0.5).normalize();
        tmp.tilt.setFromUnitVectors(UP, n);
        tmp.spin.setFromAxisAngle(UP, s.yaw + (world.spin || 0));
        const q = tmp.tilt.multiply(tmp.spin);
        if (world.spin || whirl) group.current.quaternion.copy(q);
        else group.current.quaternion.slerp(q, 1 - Math.exp(-12 * dt));
      }
    }

    // ---- 冲刺速度线：沿移动方向撒细长条，相对玩家往后退 ----
    if (boosting && speed > 1) {
      tmp.dir.copy(s.vel).normalize();
      // 起停的 0.18 秒里线条数量跟着淡，不然喷口一灭画面还在刷线
      const env = clamp(drift.boost / 0.18, 0, 1);
      lineRef?.current?.emit(s.pos, tmp.dir, speed, dt, 220 * env);
    }

    // ---- 第三人称相机：注视胸口上方，位置在球面上，并且不穿进地面 ----
    tmp.target.copy(s.pos).addScaledVector(UP, inCar ? 1.15 : 1.3);
    const cp = Math.cos(s.camPitch);
    const boostK = smoothstep(drift.boost, 0, 0.35);
    let skillZoom = 0;
    let skillFov = 0;
    if (world.move === 'wulai') {
      const sec = moveProgress(world) * 3;
      if (sec < 0.4) {
        skillZoom = 0.18;
        skillFov = 6;
      } else if (sec < 1.6) {
        skillZoom = 0.28 + (sec - 0.4) * 0.12;
        skillFov = 4;
      } else if (sec < 2.4) {
        skillZoom = 0.42;
        skillFov = 10;
      } else {
        const fade = 1 - (sec - 2.4) / 0.6;
        skillZoom = 0.42 * fade;
        skillFov = 10 * fade;
      }
    } else if (world.heavy > 0) {
      const ht = 1 - world.heavy / HEAVY_TIME;
      if (ht < 0.42) {
        const c = ht / 0.42;
        skillZoom = -0.08 * c;
        skillFov = -8 * c;
      } else if (ht < 0.62) {
        skillZoom = 0.16;
        skillFov = 12;
      } else {
        const fade = 1 - (ht - 0.62) / 0.38;
        skillZoom = 0.16 * fade;
        skillFov = 12 * fade;
      }
    }
    tmp.camPos
      .set(Math.sin(s.camYaw) * cp, Math.sin(s.camPitch), Math.cos(s.camYaw) * cp)
      // 跑得快 / 喷氮气时镜头拉远，速度感更强
      .multiplyScalar(
        s.camDist *
          (1 +
            0.12 * s.runMix +
            0.22 * boostK +
            (inCar ? 0.08 * s.runMix : 0) +
            0.035 * Math.max(0, s.pos.y - ground) +
            skillZoom),
      )
      .add(tmp.target);
    tmp.camPos.y = Math.max(tmp.camPos.y, terrainHeight(tmp.camPos.x, tmp.camPos.z) + 0.8);
    if (fx.shake > 0) {
      tmp.camPos.x += (Math.random() - 0.5) * fx.shake * 0.7;
      tmp.camPos.y += (Math.random() - 0.5) * fx.shake * 0.45;
      tmp.camPos.z += (Math.random() - 0.5) * fx.shake * 0.7;
      fx.shake = Math.max(0, fx.shake - dtRaw * 2.6);
    }
    camera.position.lerp(tmp.camPos, 1 - Math.exp(-13 * dt));
    camera.lookAt(tmp.target);

    // 氮气时把视野拉宽，边缘向后扯动的速度线感
    if (!s.baseFov) s.baseFov = camera.fov;
    const fov = s.baseFov + 13 * boostK + skillFov;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // 开发期的观察窗口：转向符号 / 侧滑角这些东西从截图上看不出来，
    // 只能靠无头浏览器读这几个数（见 tools 下的 probe_turn 脚本）
    if (import.meta.env.DEV) {
      window.__pl = { yaw: s.yaw, slip: s.slip, x: s.pos.x, y: s.pos.y, z: s.pos.z, vx: s.vel.x, vy: s.vy, vz: s.vel.z, air: s.air, charge: s.charge };
      window.__drift = drift;
      window.__combat = combat;
      window.__world = world;
      window.__jump = (charge = 1) => {
        s.charge = charge;
        s.charging = true;
        s.wantJump = true;
      };
      window.__setCharge = (charge = 1) => {
        s.charging = true;
        s.charge = charge;
      };
    }

    world.x = s.pos.x;
    world.y = s.pos.y;
    world.z = s.pos.z;
    world.yaw = s.yaw;
    world.air = s.air;
    if (!combat.dead) tryPickup(s.pos.x, s.pos.z);

    // 主光跟着玩家走，阴影贴图才够密
    const light = lightRef?.current;
    if (light) {
      light.position.set(s.pos.x - 9, s.pos.y + 16, s.pos.z + 11);
      light.target.position.copy(s.pos);
      light.target.updateMatrixWorld();
    }
  });

  return (
    <group ref={group}>
      <Person poseRef={poseRef} rig={LOCO_RIG} />
      <group ref={fxWrap}>
        <AttackFx />
        <HeavySkillFx />
        <WhirlFx />
        <WulaiUlt />
      </group>
      <NitroFlame stateRef={flameRef} />
    </group>
  );
}
