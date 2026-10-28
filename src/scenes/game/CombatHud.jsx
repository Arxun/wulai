import { useEffect, useState } from 'react';
import { COMBO, moveOf } from './skills';
import { HERO_NAME } from '../../config/lore';
import {
  LEVEL_MAX,
  POTIONS,
  WEAPON_ORDER,
  WEAPONS,
  combat,
  equipWeapon,
  liveStats,
  usePotion,
  world,
} from './stores/combatStore';

/**
 * 人物信息：头像 + 血蓝 + 等级经验 + 攻防武器 + 药品（位于 MapHudHeader 下方）。
 * 100ms 读一次 combatStore，和右上角氮气面板同一套路。
 */

function Avatar() {
  return (
    <div className="av" aria-label={HERO_NAME} title={HERO_NAME}>
      <i className="av-hair" />
      <i className="av-face" />
      <i className="av-glass" />
      <i className="av-glass av-glass-r" />
      <i className="av-bridge" />
      <i className="av-collar" />
    </div>
  );
}

export default function CombatHud() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);
  const s = liveStats();
  const hp = s.maxHp ? combat.hp / s.maxHp : 0;
  const mp = s.maxMp ? combat.mp / s.maxMp : 0;
  const xp = s.xpNeed ? combat.xp / s.xpNeed : 1;
  void tick;

  return (
    <div className={`chud${combat.hurt > 0 ? ' hit' : ''}${combat.dead ? ' down' : ''}`}>
      <Avatar />
      <div className="chud-main">
        <div className="chud-name">
          <b>{HERO_NAME}</b>
          <span>Lv.{combat.level}{combat.level >= LEVEL_MAX ? ' MAX' : ''}</span>
        </div>
        <div className="chud-bar hp">
          <i style={{ width: `${Math.max(0, hp) * 100}%` }} />
          <em>
            {Math.ceil(combat.hp)} / {s.maxHp}
          </em>
        </div>
        <div className="chud-bar mp">
          <i style={{ width: `${Math.max(0, mp) * 100}%` }} />
          <em>
            {Math.ceil(combat.mp)} / {s.maxMp}
          </em>
        </div>
        <div className="chud-bar xp">
          <i style={{ width: `${Math.max(0, Math.min(1, xp)) * 100}%` }} />
        </div>
        <div className="chud-meta">
          <span>攻 {s.atk}</span>
          <span>防 {s.def}</span>
          <span className="chud-wep">{s.weaponName}</span>
        </div>
        <div className="chud-atk">
          <em>J 刺/劈/砍/旋</em>
          <em>空中 J</em>
          <em>E</em>
          <em>K</em>
          <em>R</em>
        </div>
        {world.move ? (
          <div className="chud-move">{moveOf(world.move).name}</div>
        ) : (
          <div className="chud-combo">
            {COMBO.map((id, i) => (
              <i key={id} className={world.combo === i && world.comboGate > 0 ? 'next' : ''}>
                {moveOf(id).name}
              </i>
            ))}
          </div>
        )}
      </div>
      {combat.toastAge > 0 && <div className="chud-toast">{combat.toast}</div>}
      <div className="chud-side">
        <div className="chud-bag">
          {WEAPON_ORDER.map((id, i) => (
            <b
              key={id}
              className={`${combat.owned[id] ? 'own' : ''}${combat.weapon === id ? ' on' : ''}`}
              title={WEAPONS[id].name}
              onClick={() => equipWeapon(id)}
            >
              {i + 1}
            </b>
          ))}
        </div>
        <div className="chud-pots">
          <b className={`hp${combat.pots.hp ? ' own' : ''}`} title={POTIONS.hp.name} onClick={() => usePotion('hp')}>
            Q {combat.pots.hp}
          </b>
        </div>
      </div>
    </div>
  );
}
