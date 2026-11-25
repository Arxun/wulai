import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMoves, tickMoves } from '../../../lib/animation/combatMoves';
import { HERO } from '../hero/def';
import { GAME_PERF } from '../config/perf';
import { HALF, MAP_SIZE, SPAWN, groundMeshHeight, terrainHeight } from '../maps/huangshan/heightfield';
import { resolveDriveBlockers, resolvePlayerObstacles, SU7_SPAWN } from '../maps/huangshan/obstacles';
import { getHuangshanProps } from '../maps/huangshan/props';
import { carPoseGap, fitCarToGround } from '../vehicles/carGround';
import { activeMap, DEFAULT_MAP_ID, getMapId, MAPS, setMapId } from '../maps/registry';
import { MONSTER_KINDS } from '../monsters/kinds';
import { pickMonsterOnRay } from '../monsters/pick';
import { getMonsterPack } from '../monsters/pack';
import { buildMonsterBatches, MONSTER_LAYOUT } from '../monsters/monsterBatch';
import { makeMonsterGeo } from '../monsters/monsterMeshes';
import {
  VEHICLE_DEFS,
  DEFAULT_VEHICLE_ID,
  CAR_INTERACT_DIST,
  activeVehicleSpeedMult,
  summonVehicleBeside,
  summonVehicleForPlayer,
  vehicle,
} from '../vehicles';
import { SU7_VEHICLE } from '../vehicles/su7/def';
import {
  bindSu7WheelModel,
  getSu7WheelHub,
  setupSu7WheelSpinners,
  SU7_WHEEL_HALF_TRACK,
  updateSu7Wheels,
} from '../vehicles/su7/wheels';
import { guardFrame, logWulaiBootChecks } from '../debug/reportError';
import { markSkillFxWarmupRoot } from '../debug/warmupShaders';
import {
  beginGameLoad,
  completeGameLoadWarmup,
  getGameLoadingState,
  markGameLoadCriticalReady,
  resetGameLoad,
  updateGameLoadAssets,
} from '../stores/gameLoadingStore';
import * as THREE from 'three';
import { resetDrift, drift, NITRO_MAX, tryActivateNitro, BOOST_TIME } from '../stores/driftStore';
import {
  POTION_ORDER,
  POTIONS,
  WEAPONS,
  combat,
  equipWeapon,
  grantWeapon,
  liveStats,
  unequipWeapon,
  loot,
  resetCombat,
  setQuickPotion,
  spawnLoot,
  statsAt,
  tryPickup,
  usePotion,
  world,
} from '../stores/combatStore';
import { FX_LIGHT_SLOTS, pickFxLights, requestFxLight, resetFxLights } from '../fx/fxLightStore';
import { vehicle as vehicleRuntime } from '../vehicles/runtime';

describe('地图模块 maps/', () => {
  it('默认地图为黄山', () => {
    expect(getMapId()).toBe('huangshan');
    expect(DEFAULT_MAP_ID).toBe('huangshan');
    expect(MAPS.huangshan.label).toBe('黄山步道');
  });

  it('activeMap 提供高度场与障碍 API', () => {
    const map = activeMap();
    expect(typeof map.terrainHeight).toBe('function');
    expect(typeof map.resolvePlayerObstacles).toBe('function');
    expect(map.MAP_ENV.id).toBe('huangshan');
  });

  it('setMapId 仅允许已注册地图', () => {
    expect(() => setMapId('nope')).toThrow(/未知地图/);
    setMapId('huangshan');
    expect(getMapId()).toBe('huangshan');
  });

  it('出生点高度为有限数值', () => {
    const y = terrainHeight(SPAWN[0], SPAWN[1]);
    expect(Number.isFinite(y)).toBe(true);
  });

  it('地面网格顶点高度和高度场一致', () => {
    const seg = GAME_PERF.terrainSegments;
    const cell = MAP_SIZE / seg;
    const x = -HALF + 40 * cell;
    const z = HALF - 20 * cell;
    expect(groundMeshHeight(x, z)).toBeCloseTo(terrainHeight(x, z), 5);
  });
});

describe('载具模块 vehicles/', () => {
  it('SU7 在注册表且移速倍率正确', () => {
    expect(VEHICLE_DEFS.su7).toBe(SU7_VEHICLE);
    expect(VEHICLE_DEFS[DEFAULT_VEHICLE_ID].speedMult).toBe(2);
  });

  it('activeVehicleSpeedMult 跟随 vehicleId', () => {
    const prev = vehicle.vehicleId;
    vehicle.vehicleId = 'su7';
    expect(activeVehicleSpeedMult()).toBe(2);
    vehicle.vehicleId = prev;
  });

  it('bindSu7WheelModel + updateSu7Wheels 对齐 replica Car 轮子逻辑', () => {
    const root = new THREE.Group();
    const hub = new THREE.Group();
    hub.name = 'Wheel';
    root.add(hub);
    const a = new THREE.Group();
    a.name = 'Wheel.001';
    a.position.set(1.5, 0.36, 0);
    const b = new THREE.Group();
    b.name = 'Wheel.002';
    b.position.set(-1.5, 0.36, 0);
    hub.add(a, b);
    const wheelModel = bindSu7WheelModel(root);
    expect(wheelModel).toBe(getSu7WheelHub(root));
    const spinners = setupSu7WheelSpinners(root);
    expect(spinners).toHaveLength(2);
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(true);
    for (const w of spinners) {
      expect(w.visible).toBe(true);
      expect(w.position.z).toBe(0);
    }
    const rz0 = spinners[0].rotation.z;
    updateSu7Wheels(wheelModel, 5, 1 / 60);
    expect(spinners[0].rotation.z).not.toBe(rz0);
  });

  it('SU7 初始位姿与地图 spawn 一致', () => {
    expect(vehicle.carX).toBe(SU7_SPAWN.x);
    expect(vehicle.carZ).toBe(SU7_SPAWN.z);
    expect(vehicle.carYaw).toBe(SU7_SPAWN.rotationY);
  });

  it('召唤把车放到主驾侧，人在车外且够得着上车', () => {
    const prev = {
      ready: vehicle.ready,
      inCar: vehicle.inCar,
      carX: vehicle.carX,
      carZ: vehicle.carZ,
      carYaw: vehicle.carYaw,
      driveSpeed: vehicle.driveSpeed,
      near: vehicle.near,
    };
    vehicle.ready = true;
    vehicle.inCar = false;
    const px = 12;
    const pz = -8;
    const yaw = 0.6;
    const side = SU7_SPAWN.halfWidth * SU7_SPAWN.scale + 0.75;
    expect(summonVehicleBeside(px, pz, yaw)).toBe(true);
    expect(vehicle.carX).toBeCloseTo(px + Math.cos(yaw) * side, 5);
    expect(vehicle.carZ).toBeCloseTo(pz - Math.sin(yaw) * side, 5);
    expect(vehicle.carYaw).toBe(yaw);
    const dist = Math.hypot(vehicle.carX - px, vehicle.carZ - pz);
    expect(dist).toBeLessThanOrEqual(CAR_INTERACT_DIST);
    expect(resolvePlayerObstacles(px, pz, {
      car: { carX: vehicle.carX, carZ: vehicle.carZ, carYaw: vehicle.carYaw },
    }).hit).toBe(false);
    expect(vehicle.near).toBe(true);

    const edge = HALF - 5;
    expect(summonVehicleBeside(edge, edge, Math.PI / 4)).toBe(true);
    expect(Math.abs(vehicle.carX)).toBeLessThanOrEqual(edge);
    expect(Math.abs(vehicle.carZ)).toBeLessThanOrEqual(edge);
    expect(Math.hypot(vehicle.carX - edge, vehicle.carZ - edge)).toBeLessThanOrEqual(CAR_INTERACT_DIST);

    vehicle.inCar = true;
    const parked = vehicle.carX;
    expect(summonVehicleBeside(0, 0, 0)).toBe(false);
    expect(vehicle.carX).toBe(parked);
    vehicle.ready = false;
    vehicle.inCar = false;
    expect(summonVehicleBeside(0, 0, 0)).toBe(false);
    const parkedUnready = vehicle.carX;
    combat.dead = false;
    expect(summonVehicleForPlayer(0, 0, 0)).toBe(false);
    expect(vehicle.carX).toBe(parkedUnready);
    expect(combat.toast).toBe('载具加载中');

    Object.assign(vehicle, prev);
  });

  it('sm_car.gltf 保留 Wheel 组层级（压缩不能 flatten/join）', () => {
    const gltf = JSON.parse(readFileSync(new URL('../../../../public/models/su7/sm_car.gltf', import.meta.url), 'utf8'));
    const hub = gltf.nodes.find((n) => n.name === 'Wheel');
    expect(hub).toBeTruthy();
    const kids = (hub.children || []).map((i) => gltf.nodes[i].name);
    expect(kids.filter((n) => /^Wheel\./.test(n)).length).toBeGreaterThanOrEqual(2);
  });
});

describe('碰撞 obstacles', () => {
  it('出生点不在 SU7 OBB 内', () => {
    const r = resolvePlayerObstacles(SPAWN[0], SPAWN[1], {
      car: { carX: vehicle.carX, carZ: vehicle.carZ, carYaw: vehicle.carYaw },
    });
    expect(r.hit).toBe(false);
  });

  it('ignoreSu7 时不做车身分离', () => {
    const inside = resolvePlayerObstacles(vehicle.carX, vehicle.carZ, { ignoreSu7: true });
    expect(inside.hit).toBe(false);
  });

  it('贴近车心会被推出', () => {
    const r = resolvePlayerObstacles(vehicle.carX, vehicle.carZ, {
      car: { carX: vehicle.carX, carZ: vehicle.carZ, carYaw: vehicle.carYaw },
    });
    expect(r.hit).toBe(true);
    expect(Math.hypot(r.x - vehicle.carX, r.z - vehicle.carZ)).toBeGreaterThan(0.01);
  });

  it('山路上开车不会被树挡住，开进巨石会被顶出来', () => {
    expect(resolveDriveBlockers(SPAWN[0], SPAWN[1], 0.4).hit).toBe(false);
    const yaw = Math.atan2(16, -16);
    expect(resolveDriveBlockers(-6, 18, yaw).hit).toBe(false);
    const rock = getHuangshanProps().boulder[0];
    const hit = resolveDriveBlockers(rock.x, rock.z, 0);
    expect(hit.hit).toBe(true);
    expect(Math.hypot(hit.x - rock.x, hit.z - rock.z)).toBeGreaterThan(0.5);
  });
});

describe('开车贴地 carGround', () => {
  it('平地上几乎不倾斜，高度仍贴着地面', () => {
    const pose = fitCarToGround(SPAWN[0], SPAWN[1], 0.2, 1, 0.06);
    expect(Math.abs(pose.pitch)).toBeLessThan(0.08);
    expect(Math.abs(pose.roll)).toBeLessThan(0.08);
    expect(pose.y).toBeCloseTo(terrainHeight(SPAWN[0], SPAWN[1]) - 0.06, 1);
  });

  it('陡坡上车身跟着坡抬，采样点不会埋进山里', () => {
    let best = null;
    let bestDrop = 0;
    for (let x = -72; x <= 72; x += 12) {
      for (let z = -72; z <= 72; z += 12) {
        const north = terrainHeight(x, z + 2.2);
        const south = terrainHeight(x, z - 2.2);
        const drop = Math.abs(north - south);
        if (drop > bestDrop) {
          bestDrop = drop;
          best = { x, z, yaw: north >= south ? 0 : Math.PI };
        }
      }
    }
    expect(bestDrop).toBeGreaterThan(0.6);
    const pose = fitCarToGround(best.x, best.z, best.yaw, 1, 0.06);
    expect(Math.abs(pose.pitch)).toBeGreaterThan(0.04);
    expect(carPoseGap(best.x, best.z, best.yaw, pose, 1)).toBeGreaterThan(-0.1);
  });

  it('格子内部高度落在可见三角面上', () => {
    const seg = GAME_PERF.terrainSegments;
    const cell = MAP_SIZE / seg;
    const g = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const index = g.index.array;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    const x = -HALF + (40 + 0.37) * cell;
    const z = -HALF + (20 + 0.22) * cell;
    let onMesh = null;
    for (let t = 0; t < index.length; t += 3) {
      const ia = index[t];
      const ib = index[t + 1];
      const ic = index[t + 2];
      const ax = pos.getX(ia);
      const az = pos.getZ(ia);
      const bx = pos.getX(ib);
      const bz = pos.getZ(ib);
      const cx = pos.getX(ic);
      const cz = pos.getZ(ic);
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den;
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
      const w = 1 - u - v;
      if (u >= -1e-4 && v >= -1e-4 && w >= -1e-4) {
        onMesh = u * pos.getY(ia) + v * pos.getY(ib) + w * pos.getY(ic);
        break;
      }
    }
    expect(onMesh).not.toBeNull();
    expect(groundMeshHeight(x, z)).toBeCloseTo(onMesh, 4);
    g.dispose();
  });
});

describe('主角 hero/', () => {
  it('小武元数据', () => {
    expect(HERO.id).toBe('xiaowu');
    expect(HERO.name).toBeTruthy();
    expect(HERO.height).toBeGreaterThan(1.5);
  });
});

describe('怪物 monsters/', () => {
  it('上车后 vehicle.inCar 为真（怪物 AI 不追打玩家）', () => {
    vehicle.inCar = true;
    expect(vehicle.inCar).toBe(true);
    vehicle.inCar = false;
  });

  it('地面网格右邻、上邻就是坡度采样点', () => {
    const SEG = 8;
    const g = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const grid = SEG + 1;
    const eps = MAP_SIZE / SEG;
    expect(pos.count).toBe(grid * grid);
    for (let i = 0; i < pos.count; i++) {
      const ix = i % grid;
      const iy = (i / grid) | 0;
      const x = pos.getX(i);
      const z = pos.getZ(i);
      if (ix < SEG) {
        expect(pos.getX(i + 1)).toBeCloseTo(x + eps, 4);
        expect(pos.getZ(i + 1)).toBeCloseTo(z, 4);
      }
      if (iy < SEG) {
        expect(pos.getX(i + grid)).toBeCloseTo(x, 4);
        expect(pos.getZ(i + grid)).toBeCloseTo(z + eps, 4);
      }
    }
    g.dispose();
  });

  it('鼠标射线打中最近的活怪', () => {
    const live = { id: 1, kind: 'fox', x: 0, y: 0, z: 0, hp: 10, dead: false };
    const far = { id: 2, kind: 'fox', x: 0, y: 0, z: -8, hp: 10, dead: false };
    const dead = { id: 3, kind: 'pebble', x: 0, y: 0, z: 3, hp: 0, dead: true };
    expect(pickMonsterOnRay(0, 1, 6, 0, 0, -1, [dead, far, live])).toBe(live);
    expect(pickMonsterOnRay(4, 1, 6, 0, 0, -1, [live])).toBe(null);
    expect(pickMonsterOnRay(0, 5, 6, 0, 0, -1, [live])).toBe(null);
  });

  it('至少三种怪且数值完整', () => {
    for (const id of ['pebble', 'fox', 'crow']) {
      const spec = MONSTER_KINDS[id];
      expect(spec, id).toBeTruthy();
      expect(spec.hp).toBeGreaterThan(0);
      expect(spec.atk).toBeGreaterThan(0);
      expect(spec.count).toBeGreaterThan(0);
    }
  });

  it('角 Boss 固定锚点且强度高于山魈', () => {
    for (const id of ['titan', 'wyrm']) {
      const spec = MONSTER_KINDS[id];
      expect(spec.boss).toBe(true);
      expect(spec.hp).toBeGreaterThan(MONSTER_KINDS.oni.hp);
      expect(spec.zone.anchor?.length).toBe(2);
    }
  });

  it('getMonsterPack 含两只角 Boss', () => {
    const pack = getMonsterPack();
    expect(pack.filter((m) => m.kind === 'titan')).toHaveLength(1);
    expect(pack.filter((m) => m.kind === 'wyrm')).toHaveLength(1);
  });
});

describe('技能 tickMoves 兜底', () => {
  it('lock 与 swing 不同步时会被 tickMoves 解除', () => {
    const world = {
      move: 'wulai',
      swing: 0,
      heavy: 0,
      lock: true,
      striking: false,
      queued: false,
      combo: 0,
      comboGate: 0,
      spin: 0,
      waveR: 0,
      craterArmed: false,
      crater: { on: false },
    };
    tickMoves(world, 0.016);
    expect(world.lock).toBe(false);
    expect(world.move).toBe('');
  });

  it('resetMoves 清空招式状态', () => {
    const world = { move: 'whirl', swing: 1, heavy: 0, lock: true, crater: { on: true } };
    resetMoves(world);
    expect(world.swing).toBe(0);
    expect(world.lock).toBe(false);
    expect(world.move).toBe('');
  });
});

describe('漂移 driftStore', () => {
  it('resetDrift 恢复初始氮气', () => {
    drift.nitro = NITRO_MAX;
    drift.boost = 2;
    resetDrift();
    expect(drift.nitro).toBe(0);
    expect(drift.boost).toBe(0);
  });

  it('tryActivateNitro 消耗一瓶并进入 BOOST', () => {
    resetDrift();
    drift.nitro = 1;
    expect(tryActivateNitro()).toBe(true);
    expect(drift.nitro).toBe(0);
    expect(drift.boost).toBe(BOOST_TIME);
    expect(tryActivateNitro()).toBe(false);
  });
});

describe('共享点光池 fx/fxLightStore', () => {
  const c = new THREE.Color('#ffffff');

  it('只点亮分数最高的 FX_LIGHT_SLOTS 个请求', () => {
    resetFxLights();
    for (let i = 0; i < FX_LIGHT_SLOTS + 3; i++) requestFxLight(`k${i}`, 0, 0, 0, c, i + 1, 10, 2);
    const picked = pickFxLights(0, 0, 0);
    expect(picked.length).toBe(FX_LIGHT_SLOTS);
    expect(picked[0].intensity).toBe(FX_LIGHT_SLOTS + 3);
  });

  it('不再提交的请求在下一帧之后被清掉', () => {
    resetFxLights();
    requestFxLight('a', 0, 0, 0, c, 2, 10, 2);
    expect(pickFxLights(0, 0, 0).length).toBe(1);
    expect(pickFxLights(0, 0, 0).length).toBe(1);
    expect(pickFxLights(0, 0, 0).length).toBe(0);
  });

  it('离镜头近的请求优先于同亮度的远处请求', () => {
    resetFxLights();
    requestFxLight('far', 200, 0, 0, c, 2, 3, 2);
    requestFxLight('near', 1, 0, 0, c, 2, 3, 2);
    expect(pickFxLights(0, 0, 0, 1)[0].x).toBe(1);
  });
});

describe('诊断 debug/（自检）', () => {
  it('vehicles/runtime 独立加载且 inCar 为布尔', () => {
    expect(vehicleRuntime).toBeTruthy();
    expect(typeof vehicleRuntime.inCar).toBe('boolean');
    expect(typeof vehicleRuntime.vehicleId).toBe('string');
  });

  it('logWulaiBootChecks 在完整 store 下不抛错', () => {
    expect(() => logWulaiBootChecks({ vehicle: vehicleRuntime, world, combat })).not.toThrow();
  });

  it('gameLoadingStore 进图与进度', () => {
    resetGameLoad();
    beginGameLoad();
    expect(getGameLoadingState().show).toBe(true);
    expect(getGameLoadingState().phase).toBe('loading');
    updateGameLoadAssets({ active: false, progress: 100, loaded: 2, total: 2 });
    expect(getGameLoadingState().progress).toBe(100);
    expect(getGameLoadingState().assetsReady).toBe(true);
    markGameLoadCriticalReady();
    expect(getGameLoadingState().criticalReady).toBe(true);
    completeGameLoadWarmup();
    expect(getGameLoadingState().warmupDone).toBe(true);
    resetGameLoad();
    expect(getGameLoadingState().phase).toBe('hidden');
  });

  it('probeWebGLGpu 在无 document 时安全降级', async () => {
    const { probeWebGLGpu } = await import('../lib/gpuAccel');
    const p = probeWebGLGpu();
    expect(p.software).toBe(true);
    expect(p.preferHighPerformance).toBe(false);
  });

  it('markSkillFxWarmupRoot 标记特效根节点', () => {
    const g = new THREE.Group();
    markSkillFxWarmupRoot(g);
    expect(g.userData.wulaiSkillFxWarmup).toBe(true);
    markSkillFxWarmupRoot(g, { tier: 'ult' });
    expect(g.userData.wulaiSkillFxWarmupTier).toBe('ult');
  });

  it('guardFrame 吞掉 useFrame 内异常', () => {
    let calls = 0;
    const wrapped = guardFrame('test', () => {
      calls += 1;
      throw new Error('自检用例');
    });
    expect(() => wrapped()).not.toThrow();
    expect(calls).toBe(1);
  });
});

describe('怪物合批 monsters/monsterBatch', () => {
  const geo = makeMonsterGeo();
  const batches = buildMonsterBatches(geo);

  it('每种出场怪都有布局，合批后顶点数 = 零件顶点数之和', () => {
    const kinds = new Set(getMonsterPack().map((m) => m.kind));
    for (const kind of kinds) {
      expect(MONSTER_LAYOUT[kind], kind).toBeTruthy();
      const expected = MONSTER_LAYOUT[kind].parts.reduce((n, p) => n + geo[kind][p.g].attributes.position.count, 0);
      const got = batches[kind].reduce((n, b) => n + b.geometry.attributes.position.count, 0);
      expect(got, kind).toBe(expected);
      const roughs = new Set(MONSTER_LAYOUT[kind].parts.map((p) => p.rough));
      expect(batches[kind].length, kind).toBe(roughs.size);
    }
  });

  it('镜像零件烘焙后三角形绕序与法线一致（不会被背面剔除）', () => {
    for (const [kind, list] of Object.entries(batches)) {
      for (const { geometry } of list) {
        const pos = geometry.attributes.position.array;
        const nor = geometry.attributes.normal.array;
        let bad = 0;
        let total = 0;
        for (let t = 0; t < pos.length; t += 9) {
          const ux = pos[t + 3] - pos[t], uy = pos[t + 4] - pos[t + 1], uz = pos[t + 5] - pos[t + 2];
          const vx = pos[t + 6] - pos[t], vy = pos[t + 7] - pos[t + 1], vz = pos[t + 8] - pos[t + 2];
          const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
          if (Math.hypot(cx, cy, cz) < 1e-9) continue;
          total++;
          if (cx * nor[t] + cy * nor[t + 1] + cz * nor[t + 2] < 0) bad++;
        }
        expect(bad, kind).toBe(0);
        expect(total).toBeGreaterThan(0);
      }
    }
  });
});

describe('背包 stores/combatStore：血药与换武器', () => {
  beforeEach(() => {
    resetCombat();
    world.x = 0;
    world.y = 0;
    world.z = 0;
  });
  afterEach(() => resetCombat());

  const hurtTo = (hp) => {
    combat.hp = hp;
  };

  it('血药按档位登记，回血量逐档变大，颜色齐全', () => {
    expect(POTION_ORDER.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(POTIONS).sort()).toEqual([...POTION_ORDER].sort());
    let prev = 0;
    for (const id of POTION_ORDER) {
      const p = POTIONS[id];
      expect(p.id).toBe(id);
      expect(p.name).toBeTruthy();
      expect(p.hp).toBeGreaterThan(prev);
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.glow).toMatch(/^#[0-9a-f]{6}$/i);
      prev = p.hp;
    }
  });

  it('怪物掉落表里的每一项都是已登记的武器或血药，概率在 (0, 1]', () => {
    const dropped = new Set();
    for (const [kind, def] of Object.entries(MONSTER_KINDS)) {
      for (const [id, p] of Object.entries(def.drop)) {
        expect(WEAPONS[id] || POTIONS[id], `${kind} 掉落 ${id}`).toBeTruthy();
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThanOrEqual(1);
        dropped.add(id);
      }
    }
    for (const id of POTION_ORDER) expect(dropped.has(id), `没有怪掉 ${id}`).toBe(true);
  });

  it('Q 默认喝回血丹：扣一瓶、按药效回血，满血不浪费', () => {
    expect(combat.quickPot).toBe('hp');
    expect(combat.pots.hp).toBe(1);
    expect(usePotion()).toBe(false);
    expect(combat.pots.hp).toBe(1);

    hurtTo(10);
    expect(usePotion()).toBe(true);
    expect(combat.hp).toBe(10 + POTIONS.hp.hp);
    expect(combat.pots.hp).toBe(0);
    expect(usePotion()).toBe(false);
  });

  it('回血不会超过生命上限', () => {
    const { maxHp } = statsAt(combat.level);
    combat.pots.hpBig = 1;
    hurtTo(maxHp - 5);
    expect(usePotion('hpBig')).toBe(true);
    expect(combat.hp).toBe(maxHp);
  });

  it('背包里选了哪种药，Q 就喝哪种；没货的不能选', () => {
    expect(setQuickPotion('hpMid')).toBe(false);
    expect(setQuickPotion('nope')).toBe(false);
    expect(combat.quickPot).toBe('hp');

    combat.pots.hpMid = 2;
    expect(setQuickPotion('hpMid')).toBe(true);
    expect(combat.quickPot).toBe('hpMid');

    hurtTo(1);
    combat.level = 30;
    expect(usePotion()).toBe(true);
    expect(combat.hp).toBe(1 + POTIONS.hpMid.hp);
    expect(combat.pots.hpMid).toBe(1);
    expect(combat.pots.hp).toBe(1);
    expect(combat.quickPot).toBe('hpMid');
  });

  it('Q 槽的药喝完后换成背包里还有的最低一档；全喝完时保持原选择', () => {
    combat.level = 30;
    combat.pots.hpMid = 1;
    combat.pots.hpBig = 1;
    setQuickPotion('hpBig');

    hurtTo(1);
    expect(usePotion()).toBe(true);
    expect(combat.pots.hpBig).toBe(0);
    expect(combat.quickPot).toBe('hp');

    hurtTo(1);
    expect(usePotion()).toBe(true);
    expect(combat.quickPot).toBe('hpMid');

    hurtTo(1);
    expect(usePotion()).toBe(true);
    expect(combat.quickPot).toBe('hpMid');
    expect(POTION_ORDER.every((id) => combat.pots[id] === 0)).toBe(true);

    hurtTo(1);
    expect(usePotion()).toBe(false);
    expect(combat.hp).toBe(1);
  });

  it('捡到的药进对应的格子；Q 槽空着时捡到的药顶上，有货时不改选择', () => {
    loot.length = 0;
    spawnLoot(0, 0, 'hpMid');
    tryPickup(0, 0);
    expect(loot.length).toBe(0);
    expect(combat.pots.hpMid).toBe(1);
    expect(combat.pots.hp).toBe(1);
    expect(combat.quickPot).toBe('hp');

    combat.pots.hp = 0;
    combat.pots.hpMid = 0;
    spawnLoot(0, 0, 'hpBig');
    tryPickup(0, 0);
    expect(combat.pots.hpBig).toBe(1);
    expect(combat.quickPot).toBe('hpBig');
  });

  it('人死了不能喝药', () => {
    hurtTo(1);
    combat.dead = true;
    expect(usePotion()).toBe(false);
    expect(combat.pots.hp).toBe(1);
  });

  it('没拿到的武器装备不上；捡到后在背包里换，提示不再提数字键', () => {
    expect(equipWeapon('iron')).toBe(false);
    expect(combat.weapon).toBe('wood');

    loot.length = 0;
    spawnLoot(0, 0, 'iron');
    tryPickup(0, 0);
    expect(combat.owned.iron).toBe(true);
    expect(combat.weapon).toBe('wood');
    expect(combat.toast).toContain('背包');
    expect(combat.toast).not.toMatch(/按 \d/);

    expect(grantWeapon('iron')).toBe(false);
    expect(equipWeapon('iron')).toBe(true);
    expect(combat.weapon).toBe('iron');
  });

  it('卸下武器后是空手，攻击只剩人物底板', () => {
    expect(unequipWeapon()).toBe(true);
    expect(combat.weapon).toBe('');
    const base = statsAt(combat.level);
    expect(liveStats().atk).toBe(base.atk);
    expect(liveStats().weaponAtk).toBe(0);
    expect(liveStats().weaponName).toBe('未装备');
    expect(unequipWeapon()).toBe(false);
    expect(equipWeapon('wood')).toBe(true);
  });

  it('重置战斗会取消系统菜单的暂停', () => {
    world.paused = true;
    resetCombat();
    expect(world.paused).toBe(false);
  });

  it('技能栏分开记录电脑键盘和手机按钮，并和实际出招键一致', async () => {
    const { SKILL_BINDS } = await import('../skills/binds');
    const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
    const player = read('../hero/Player.jsx');
    const mobile = read('../mobile/MobileRightPanel.jsx');
    expect(SKILL_BINDS.map((s) => s.id)).toEqual(['attack', 'skill', 'whirl', 'wulai']);
    expect(SKILL_BINDS.map((s) => s.pc)).toEqual(['J', 'K', 'E', 'R']);
    for (const s of SKILL_BINDS) {
      expect(s.mobile, s.id).toBeTruthy();
      expect(player).toContain(`Key${s.pc}`);
    }
    expect(mobile).toContain("code: 'KeyK'");
    expect(mobile).toContain("code: 'KeyE'");
    expect(mobile).toContain("code: 'KeyR'");
    expect(mobile).toContain("emitMobilePress('KeyJ')");
    expect(read('../SystemMenu.jsx')).toContain("label: '技能'");
  });

  it('数字键不再是游戏键（换武器只在背包里）', () => {
    const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
    expect(read('../../../lib/hooks/useKeyboard.js')).not.toMatch(/Digit|Numpad/);
    expect(read('../hero/Player.jsx')).not.toMatch(/Digit|Numpad|equipWeapon/);
    expect(read('../SystemMenu.jsx')).not.toMatch(/未获得/);
    expect(read('../GameHud.jsx')).toMatch(/Escape/);
    expect(read('../hero/Player.jsx')).toMatch(/world\.paused/);
    expect(read('../monsters/Monsters.jsx')).toMatch(/world\.paused/);
  });
});

describe('存档 stores/saveStore', () => {
  const mem = () => {
    const box = new Map();
    return {
      getItem: (k) => (box.has(k) ? box.get(k) : null),
      setItem: (k, v) => box.set(k, String(v)),
    };
  };

  afterEach(async () => {
    const { resetGameSession } = await import('../stores/gameSession');
    resetGameSession();
  });

  it('保存、覆盖、读取会带回位置、等级、道具、装备和技能', async () => {
    const { getPlayerState } = await import('../stores/gameSession');
    const { saveToSlot, loadSlot, readBook } = await import('../stores/saveStore');
    const { combat } = await import('../stores/combatStore');
    const { vehicle } = await import('../vehicles/runtime');
    const storage = mem();
    const player = getPlayerState(() => ({
      pos: new THREE.Vector3(12, 3, -8),
      vel: new THREE.Vector3(),
      knock: new THREE.Vector3(),
      yaw: 0.4,
      camYaw: 1.2,
      camPitch: 0.3,
      camDist: 6,
    }));
    combat.level = 6;
    combat.xp = 15;
    combat.hp = 40;
    combat.mp = 11;
    combat.weapon = 'iron';
    combat.owned = { wood: true, iron: true };
    combat.pots = { hp: 2, hpMid: 1, hpBig: 0 };
    combat.quickPot = 'hpMid';
    combat.skills = ['attack', 'whirl'];
    vehicle.inCar = false;
    expect(saveToSlot(1, storage).ok).toBe(true);
    expect(readBook(storage).slots[1].level).toBe(6);
    expect(readBook(storage).slots[1].x).toBeCloseTo(12);
    combat.level = 9;
    player.pos.set(20, 2, -3);
    expect(saveToSlot(1, storage).overwrite).toBe(true);
    expect(readBook(storage).slots[1].level).toBe(9);
    combat.level = 1;
    combat.weapon = 'wood';
    combat.skills = ['attack'];
    player.pos.set(0, 0, 0);
    expect(loadSlot(1, storage).ok).toBe(true);
    expect(combat.level).toBe(9);
    expect(combat.xp).toBe(15);
    expect(combat.weapon).toBe('iron');
    expect(combat.pots.hpMid).toBe(1);
    expect(combat.quickPot).toBe('hpMid');
    expect(combat.skills).toEqual(['attack', 'whirl']);
    expect(player.pos.x).toBeCloseTo(20);
    expect(player.pos.z).toBeCloseTo(-3);
    expect(player.yaw).toBeCloseTo(0.4);
    expect(loadSlot(0, storage).ok).toBe(false);
  });

  it('模块里的人物记录被清掉后，仍保存画面上这个人', async () => {
    const { resetGameSession } = await import('../stores/gameSession');
    const { saveToSlot } = await import('../stores/saveStore');
    const { world } = await import('../stores/combatStore');
    resetGameSession();
    world.player = {
      pos: new THREE.Vector3(8, 2, -5),
      vel: new THREE.Vector3(),
      knock: new THREE.Vector3(),
      yaw: 0.2,
      camYaw: 0.2,
      camPitch: 0.3,
      camDist: 5.2,
    };
    const storage = mem();
    const res = saveToSlot(0, storage);
    expect(res.ok).toBe(true);
    expect(res.slot.x).toBeCloseTo(8);
    expect(res.slot.z).toBeCloseTo(-5);
    world.player = null;
  });

  it('坏掉的本地存档当成空档', async () => {
    const { readBook } = await import('../stores/saveStore');
    const storage = { getItem: () => '{', setItem() {} };
    expect(readBook(storage).slots.every((s) => s == null)).toBe(true);
  });

  it('一共一百格，旧的四格仍留在前面，最后一格也能存', async () => {
    const { SAVE_SLOTS, SAVE_PAGES, SAVE_PAGE_SIZE, readBook, saveToSlot } = await import('../stores/saveStore');
    const { getPlayerState } = await import('../stores/gameSession');
    expect(SAVE_PAGES).toBe(10);
    expect(SAVE_PAGE_SIZE).toBe(10);
    expect(SAVE_SLOTS).toBe(100);
    const old = {
      version: 1,
      slots: [null, { level: 4, x: 6, z: -2, savedAt: 1 }, null, null],
    };
    const storage = { getItem: () => JSON.stringify(old), setItem() {} };
    const book = readBook(storage);
    expect(book.slots).toHaveLength(100);
    expect(book.slots[1].level).toBe(4);
    expect(book.slots[1].x).toBeCloseTo(6);
    expect(book.slots[4]).toBeNull();
    getPlayerState(() => ({
      pos: new THREE.Vector3(3, 1, 9),
      vel: new THREE.Vector3(),
      knock: new THREE.Vector3(),
      yaw: 0,
      camYaw: 0,
      camPitch: 0.3,
      camDist: 5.2,
    }));
    const writable = mem();
    expect(saveToSlot(99, writable).ok).toBe(true);
    expect(readBook(writable).slots[99].x).toBeCloseTo(3);
    expect(saveToSlot(100, writable).ok).toBe(false);
  });
});

describe('游戏会话 stores/gameSession', () => {
  it('Canvas remount 沿用同一份人物状态与战斗数据，只有 resetGameSession 才重置', async () => {
    const { getPlayerState, resetGameSession } = await import('../stores/gameSession');
    const { combat } = await import('../stores/combatStore');
    let created = 0;
    const make = () => {
      created += 1;
      return { pos: { x: -4, z: 12 } };
    };
    const a = getPlayerState(make);
    a.pos.x = 30;
    combat.level = 7;
    combat.weapon = 'iron';
    const b = getPlayerState(make);
    expect(b).toBe(a);
    expect(created).toBe(1);
    expect(combat.level).toBe(7);

    resetGameSession();
    expect(combat.level).toBe(1);
    expect(combat.weapon).toBe('wood');
    const c = getPlayerState(make);
    expect(c).not.toBe(a);
    expect(c.pos.x).toBe(-4);
  });
});
