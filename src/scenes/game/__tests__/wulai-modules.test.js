import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resetMoves, tickMoves } from '../../../lib/animation/combatMoves';
import { HERO } from '../hero/def';
import { HALF, MAP_SIZE, SPAWN, groundMeshHeight, terrainHeight } from '../maps/huangshan/heightfield';
import { resolvePlayerObstacles, SU7_SPAWN } from '../maps/huangshan/obstacles';
import { activeMap, DEFAULT_MAP_ID, getMapId, MAPS, setMapId } from '../maps/registry';
import { MONSTER_KINDS } from '../monsters/kinds';
import { getMonsterPack } from '../monsters/pack';
import { buildMonsterBatches, MONSTER_LAYOUT } from '../monsters/monsterBatch';
import { makeMonsterGeo } from '../monsters/monsterMeshes';
import { VEHICLE_DEFS, DEFAULT_VEHICLE_ID, activeVehicleSpeedMult, vehicle } from '../vehicles';
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
import { combat, world } from '../stores/combatStore';
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
    const seg = 176;
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
