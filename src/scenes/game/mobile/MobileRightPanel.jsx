import { useEffect, useState } from 'react';
import { moveOf } from '../skills';
import { combat } from '../stores/combatStore';
import { drift, NITRO_MAX } from '../stores/driftStore';
import { vehicle } from '../vehicles/runtime';
import { emitMobilePress, setMobileKey } from './mobileInputStore';

/** 绕普攻键 90° 弧：从下往上 崩 → 回 → 武 → 血 */
const ARC_SLOTS = [
  { code: 'KeyK', moveId: 'skill' },
  { code: 'KeyE', moveId: 'whirl', whirl: true },
  { code: 'KeyR', moveId: 'wulai', ult: true },
  { kind: 'pot' },
];

const DRIFT_CODE = 'ShiftRight';

/** 普攻圆心为锚点，角度从 190°（偏下）到 100°（偏上），共 90° */
const ARC_DEG_START = 190;
const ARC_DEG_END = 100;
const ORBIT_R = 78;
const CLUSTER = 172;
const ATTACK_SZ = 76;
const ORBIT_BTN = 50;

function skillInitial(moveId) {
  const name = moveOf(moveId).name;
  return name ? name[0] : '?';
}

function orbitPos(index, total) {
  const t = total <= 1 ? 0 : index / (total - 1);
  const deg = ARC_DEG_START + (ARC_DEG_END - ARC_DEG_START) * t;
  const rad = (deg * Math.PI) / 180;
  const cx = CLUSTER - ATTACK_SZ / 2;
  const cy = CLUSTER - ATTACK_SZ / 2;
  return {
    left: cx + ORBIT_R * Math.cos(rad) - ORBIT_BTN / 2,
    top: cy - ORBIT_R * Math.sin(rad) - ORBIT_BTN / 2,
  };
}

function SwordIcon() {
  return (
    <svg className="mobile-attack-btn__svg" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2 9 5v3.5L4.5 13l1.4 1.4L10.5 9.8 11 10.3V20h2V10.3l.1-.1 4.6 4.6 1.4-1.4L13 8.5V5l-1-1Z"
      />
    </svg>
  );
}

export default function MobileRightPanel() {
  const [snap, setSnap] = useState({
    inCar: false,
    nearCar: false,
    nitro: 0,
    boost: 0,
    wulaiCd: 0,
    whirlCd: 0,
    dead: false,
    potsHp: 0,
  });

  useEffect(() => {
    const id = setInterval(
      () =>
        setSnap({
          inCar: vehicle.inCar,
          nearCar: vehicle.near,
          nitro: drift.nitro,
          boost: drift.boost,
          wulaiCd: combat.wulaiCd,
          whirlCd: combat.whirlCd,
          dead: combat.dead,
          potsHp: combat.pots.hp || 0,
        }),
      80,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      setMobileKey(DRIFT_CODE, false);
    },
    [],
  );

  const tapSkill = (code, disabled) => (e) => {
    if (disabled || snap.dead || snap.inCar) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    emitMobilePress(code);
  };

  const tapAttack = (e) => {
    e.preventDefault();
    if (snap.dead || snap.inCar) return;
    emitMobilePress('KeyJ');
  };

  const tapPotion = (e) => {
    e.preventDefault();
    if (snap.dead || snap.potsHp <= 0) return;
    emitMobilePress('KeyQ');
  };

  const tapNitro = (e) => {
    e.preventDefault();
    if (snap.dead || snap.nitro <= 0 || snap.boost > 0) return;
    emitMobilePress('ControlLeft');
  };

  const bindDrift = {
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setMobileKey(DRIFT_CODE, true);
    },
    onPointerUp: (e) => {
      setMobileKey(DRIFT_CODE, false);
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    },
    onPointerCancel: () => setMobileKey(DRIFT_CODE, false),
    onPointerLeave: (e) => {
      if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) setMobileKey(DRIFT_CODE, false);
    },
  };

  const nitroDisabled = snap.dead || snap.nitro <= 0 || snap.boost > 0;

  const exitCar = (e) => {
    e.preventDefault();
    if (snap.dead) return;
    emitMobilePress('KeyF');
  };

  const enterCar = (e) => {
    e.preventDefault();
    if (snap.dead) return;
    emitMobilePress('KeyF');
  };

  if (snap.inCar) {
    return (
      <div className="mobile-right mobile-right--drive" aria-label="驾驶">
        <button type="button" className="mobile-right__pill exit" disabled={snap.dead} onPointerDown={exitCar}>
          下车
        </button>
        <div className="mobile-right__row">
          <button
            type="button"
            className={`mobile-skills__btn mobile-drive__btn nitro${nitroDisabled ? ' mobile-skills__btn--cd' : ''}`}
            aria-label={`氮气 ${snap.nitro}/${NITRO_MAX}`}
            disabled={nitroDisabled}
            onPointerDown={tapNitro}
          >
            {snap.boost > 0 ? (
              <span className="mobile-skills__cd">喷</span>
            ) : snap.nitro <= 0 ? (
              <span className="mobile-skills__cd">0</span>
            ) : (
              '氮'
            )}
          </button>
          <button type="button" className="mobile-skills__btn mobile-drive__btn" aria-label="漂移" {...bindDrift}>
            漂
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {snap.nearCar && !snap.dead && (
        <button type="button" className="mobile-enter-center" onPointerDown={enterCar}>
          上车
        </button>
      )}
      <div className="mobile-combat-cluster" aria-label="普攻与技能">
        {ARC_SLOTS.map((slot, i) => {
          const pos = orbitPos(i, ARC_SLOTS.length);
          if (slot.kind === 'pot') {
            return (
              <button
                key="pot"
                type="button"
                className={`mobile-skills__btn mobile-skills__btn--orbit mobile-pot-btn${snap.potsHp > 0 ? ' own' : ''}`}
                style={{ left: pos.left, top: pos.top }}
                aria-label="回血丹"
                disabled={snap.dead || snap.potsHp <= 0}
                onPointerDown={tapPotion}
              >
                血
              </button>
            );
          }
          const cd = slot.ult ? snap.wulaiCd : slot.whirl ? snap.whirlCd : 0;
          const onCd = cd > 0;
          const label = skillInitial(slot.moveId);
          return (
            <button
              key={slot.code}
              type="button"
              className={`mobile-skills__btn mobile-skills__btn--orbit${onCd ? ' mobile-skills__btn--cd' : ''}${
                slot.ult ? ' mobile-skills__btn--ult' : ''
              }`}
              style={{ left: pos.left, top: pos.top }}
              aria-label={moveOf(slot.moveId).name}
              disabled={onCd || snap.dead}
              onPointerDown={tapSkill(slot.code, onCd)}
            >
              {onCd ? <span className="mobile-skills__cd">{Math.ceil(cd)}</span> : label}
            </button>
          );
        })}
        <button
          type="button"
          className="mobile-attack-btn"
          aria-label="普攻"
          disabled={snap.dead}
          onPointerDown={tapAttack}
        >
          <SwordIcon />
        </button>
      </div>
    </>
  );
}
