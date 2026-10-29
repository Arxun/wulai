import { useEffect, useState } from 'react';
import CombatHud from './CombatHud';
import MapHudHeader from './MapHudHeader';
import { combat, fx, world } from './stores/combatStore';
import { drift, BOOST_TIME, NITRO_COST, NITRO_MAX } from './stores/driftStore';
import DeathQuote from './DeathQuote';
import MobileMovePad from './mobile/MobileMovePad';
import MobileRightPanel from './mobile/MobileRightPanel';
import MobileWeaponBar from './mobile/MobileWeaponBar';
import { WulaiTitle } from './skills/fx';
import { summonVehicleForPlayer, vehicle } from './vehicles/runtime';

/**
 * 右上角的漂移 / 氮气面板。
 *
 * 这是 DOM 不是 three 的东西，所以挂在 Canvas 外面。它每 100ms 去 driftStore 取一次数：
 * 玩法数值是每帧变的，但 React 没必要每帧重渲染，10Hz 看上去已经是实时的了。
 */

const fmt = (n) => n.toFixed(1);
/** 内部速度是 m/s，HUD 用 km/h 展示 */
const MS_TO_KMH = 3.6;
const fmtSpeedKmh = (mps) => fmt(mps * MS_TO_KMH);

export default function GameHud({ mobileActive = false }) {
  const [v, setV] = useState({
    ...drift,
    hurt: 0,
    skill: 0,
    nearCar: false,
    inCar: false,
    vehicleReady: false,
    dead: false,
  });
  /** null = 跟上车状态：开车展开、步行折叠 */
  const [driveHudManual, setDriveHudManual] = useState(null);

  useEffect(() => {
    setDriveHudManual(null);
  }, [v.inCar]);

  useEffect(() => {
    const id = setInterval(
      () =>
        setV({
          ...drift,
          hurt: combat.hurt,
          skill: fx.skill,
          nearCar: vehicle.near,
          inCar: vehicle.inCar,
          vehicleReady: vehicle.ready,
          dead: combat.dead,
          toast: combat.toastAge > 0 ? combat.toast : '',
        }),
      50,
    );
    return () => clearInterval(id);
  }, []);

  const full = v.nitro >= NITRO_MAX;
  const need = Math.max(0, NITRO_COST - v.dist);
  const driveHudFolded = driveHudManual !== null ? driveHudManual : !v.inCar;

  const summonCar = () => {
    summonVehicleForPlayer(world.x, world.z, world.yaw);
  };

  const toggleDriveHud = () => {
    setDriveHudManual((prev) => {
      const folded = prev !== null ? prev : !v.inCar;
      return !folded;
    });
  };

  return (
    <>
      {/* 屏幕四周两层放射疾风线，错开转速，叠在一起更密 */}
      <div className={`hurtflash${v.hurt > 0 ? ' on' : ''}`} />
      <div className={`skillflash${v.skill > 0 ? ' on' : ''}`} />
      <WulaiTitle />
      <DeathQuote />
      {v.toast && <div className={`game-toast${mobileActive ? ' game-toast--mobile' : ''}`}>{v.toast}</div>}
      {!mobileActive && v.inCar && <div className="hud-flash interact">按 F 下车</div>}
      {!mobileActive && !v.inCar && v.nearCar && <div className="hud-flash interact">按 F 上车</div>}
      <div className={`hud-left${mobileActive ? ' hud-left--mobile' : ''}`}>
        <MapHudHeader />
        <CombatHud mobileCompact={mobileActive} />
        {mobileActive && <MobileWeaponBar />}
      </div>
      <div className={`speedlines${v.boost > 0 ? ' on' : ''}`} />
      <div className={`speedlines fine${v.boost > 0 ? ' on' : ''}`} />

      <div className="hud-dock">
      {mobileActive && !v.inCar && (
        <button
          type="button"
          className={`hud-summon${v.vehicleReady ? ' hud-summon--ready' : ''}`}
          disabled={!v.vehicleReady || v.dead}
          title={v.vehicleReady ? '把 SU7 召到身边' : '载具加载中'}
          aria-label={v.vehicleReady ? '载具' : '载具加载中'}
          onClick={summonCar}
        >
          <svg viewBox="0 0 32 16" aria-hidden>
            <path
              fill="currentColor"
              d="M5.2 11.2 8.4 6.4A2 2 0 0 1 10.1 5.4h9.2a2 2 0 0 1 1.7 1l3.4 4.8H27v1.6h-2.1a2.3 2.3 0 0 1-4.4 0h-7a2.3 2.3 0 0 1-4.4 0H5v-1.6h.2Z"
            />
          </svg>
          <span>载具</span>
        </button>
      )}
      <div
        className={`hud${driveHudFolded ? ' hud--folded' : ''}${v.boost > 0 ? ' boosting' : ''}${v.inCar ? ' hud--driving' : ''}`}
      >
        <button type="button" className="hud-fold-toggle" onClick={toggleDriveHud} aria-expanded={!driveHudFolded}>
          <span className="hud-fold-toggle__title">速度 · 氮气</span>
          {driveHudFolded && v.inCar && (
            <span className="hud-fold-toggle__peek">{fmtSpeedKmh(v.speed)} km/h</span>
          )}
          <span className="hud-fold-toggle__chev" aria-hidden>
            {driveHudFolded ? '▸' : '▾'}
          </span>
        </button>

        <div className="hud-body">
        <div className="hud-row">
          <span className="hud-label">速度</span>
          <span className="hud-value">{fmtSpeedKmh(v.speed)} km/h</span>
        </div>

        <div className="hud-row">
          <span className="hud-label">漂移距离</span>
          <span className={`hud-value${v.sliding ? ' live' : ''}`}>{fmt(v.total)} m</span>
        </div>

        <div className="hud-row">
          <span className="hud-label">{full ? '氮气已满' : '还差'}</span>
          <span className="hud-value">{full ? '—' : `${fmt(need)} m`}</span>
        </div>

        <div className="hud-bar">
          <i style={{ width: `${(full ? 1 : v.progress) * 100}%` }} />
        </div>

        <div className="hud-row">
          <span className="hud-label">氮气</span>
          <span className="hud-tanks">
            {Array.from({ length: NITRO_MAX }, (_, i) => (
              <b key={i} className={i < v.nitro ? 'on' : ''} />
            ))}
          </span>
        </div>

        {v.jumpCharge > 0 && (
          <>
            <div className="hud-row">
              <span className="hud-label">跳跃蓄力</span>
              <span className="hud-value">{(v.jumpCharge * 100).toFixed(0)}%</span>
            </div>
            <div className="hud-bar jump">
              <i style={{ width: `${v.jumpCharge * 100}%` }} />
            </div>
          </>
        )}
        {v.air && <div className="hud-flash">跳跃中</div>}
        {v.sliding && <div className="hud-flash">漂移中 +{fmt(v.combo)} m</div>}
        {v.boost > 0 && <div className="hud-flash boost">氮气喷射 {((v.boost / BOOST_TIME) * 100).toFixed(0)}%</div>}
        </div>
      </div>
      </div>
      {mobileActive && <MobileMovePad />}
      {mobileActive && <MobileRightPanel />}
    </>
  );
}
