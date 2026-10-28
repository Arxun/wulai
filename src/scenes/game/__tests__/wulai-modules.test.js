import { describe, expect, it } from 'vitest';
import { resetMoves, tickMoves } from '../../../lib/animation/combatMoves';
import { HERO } from '../hero/def';
import { SPAWN, terrainHeight } from '../maps/huangshan/heightfield';
import { resolvePlayerObstacles, SU7_SPAWN } from '../maps/huangshan/obstacles';
import { activeMap, DEFAULT_MAP_ID, getMapId, MAPS, setMapId } from '../maps/registry';
import { MONSTER_KINDS } from '../monsters/kinds';
import { VEHICLE_DEFS, DEFAULT_VEHICLE_ID, activeVehicleSpeedMult, vehicle } from '../vehicles';
import { SU7_VEHICLE } from '../vehicles/su7/def';
import {
  setupSu7WheelSpinners,
  SU7_WHEEL_HALF_TRACK,
  tickSu7WheelSpin,
} from '../vehicles/su7/wheels';
import { guardFrame, logWulaiBootChecks } from '../debug/reportError';
import { markSkillFxWarmupRoot } from '../debug/warmupShaders';
import {
  beginGameLoad,
  getGameLoadingState,
  resetGameLoad,
  updateGameLoadAssets,
} from '../stores/gameLoadingStore';
import * as THREE from 'three';
import { resetDrift, drift, NITRO_MAX } from '../stores/driftStore';
import { combat, world } from '../stores/combatStore';
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
});

describe('载具模块 vehicles/', () => {
  it('SU7 在注册表且移速倍率正确', () => {
    expect(VEHICLE_DEFS.su7).toBe(SU7_VEHICLE);
    expect(VEHICLE_DEFS[DEFAULT_VEHICLE_ID].speedMult).toBe(1.65);
  });

  it('activeVehicleSpeedMult 跟随 vehicleId', () => {
    const prev = vehicle.vehicleId;
    vehicle.vehicleId = 'su7';
    expect(activeVehicleSpeedMult()).toBe(1.65);
    vehicle.vehicleId = prev;
  });

  it('setupSu7WheelSpinners 由 2 模板生成 4 个可见轮', () => {
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
    const spinners = setupSu7WheelSpinners(root);
    expect(spinners).toHaveLength(4);
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(false);
    for (const w of spinners) {
      expect(w.visible).toBe(true);
      expect(Math.abs(w.position.z)).toBe(SU7_WHEEL_HALF_TRACK);
    }
    const rz0 = spinners[0].rotation.z;
    tickSu7WheelSpin(spinners, 5, 0.05);
    expect(spinners[0].rotation.z).not.toBe(rz0);
  });

  it('SU7 初始位姿与地图 spawn 一致', () => {
    expect(vehicle.carX).toBe(SU7_SPAWN.x);
    expect(vehicle.carZ).toBe(SU7_SPAWN.z);
    expect(vehicle.carYaw).toBe(SU7_SPAWN.rotationY);
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

  it('至少三种怪且数值完整', () => {
    for (const id of ['pebble', 'fox', 'crow']) {
      const spec = MONSTER_KINDS[id];
      expect(spec, id).toBeTruthy();
      expect(spec.hp).toBeGreaterThan(0);
      expect(spec.atk).toBeGreaterThan(0);
      expect(spec.count).toBeGreaterThan(0);
    }
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
    resetGameLoad();
    expect(getGameLoadingState().phase).toBe('hidden');
  });

  it('markSkillFxWarmupRoot 标记特效根节点', () => {
    const g = new THREE.Group();
    markSkillFxWarmupRoot(g);
    expect(g.userData.wulaiSkillFxWarmup).toBe(true);
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
