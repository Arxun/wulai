import { useEffect, useState } from 'react';
import CombatHud from './CombatHud';
import MapHudHeader from './MapHudHeader';
import { combat, fx } from './stores/combatStore';
import { drift, BOOST_TIME, NITRO_COST, NITRO_MAX } from './stores/driftStore';
import { WulaiTitle } from './skills/fx';
import { vehicle } from './vehicles/runtime';

/**
 * 右上角的漂移 / 氮气面板。
 *
 * 这是 DOM 不是 three 的东西，所以挂在 Canvas 外面。它每 100ms 去 driftStore 取一次数：
 * 玩法数值是每帧变的，但 React 没必要每帧重渲染，10Hz 看上去已经是实时的了。
 */

const fmt = (n) => n.toFixed(1);

export default function GameHud() {
  const [v, setV] = useState({ ...drift, hurt: 0, skill: 0, nearCar: false, inCar: false });

  useEffect(() => {
    const id = setInterval(
      () =>
        setV({
          ...drift,
          hurt: combat.hurt,
          skill: fx.skill,
          nearCar: vehicle.near,
          inCar: vehicle.inCar,
        }),
      50,
    );
    return () => clearInterval(id);
  }, []);

  const full = v.nitro >= NITRO_MAX;
  const need = Math.max(0, NITRO_COST - v.dist);

  return (
    <>
      {/* 屏幕四周两层放射疾风线，错开转速，叠在一起更密 */}
      <div className={`hurtflash${v.hurt > 0 ? ' on' : ''}`} />
      <div className={`skillflash${v.skill > 0 ? ' on' : ''}`} />
      <WulaiTitle />
      {v.inCar && <div className="hud-flash interact">按 F 下车</div>}
      {!v.inCar && v.nearCar && <div className="hud-flash interact">按 F 上车</div>}
      <div className="hud-left">
        <MapHudHeader />
        <CombatHud />
      </div>
      <div className={`speedlines${v.boost > 0 ? ' on' : ''}`} />
      <div className={`speedlines fine${v.boost > 0 ? ' on' : ''}`} />

      <div className={`hud${v.boost > 0 ? ' boosting' : ''}`}>
        <div className="hud-row">
          <span className="hud-label">速度</span>
          <span className="hud-value">{fmt(v.speed)} m/s</span>
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
    </>
  );
}
