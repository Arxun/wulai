import { combat, equipWeapon, WEAPON_ORDER, WEAPONS } from '../stores/combatStore';

/** 移动端武器栏：1–6 大按钮切换装备 */
export default function MobileWeaponBar() {
  return (
    <div className="mobile-weapons" aria-label="切换武器">
      {WEAPON_ORDER.map((id, i) => {
        const owned = combat.owned[id];
        const on = combat.weapon === id;
        return (
          <button
            key={id}
            type="button"
            className={`mobile-weapons__btn${owned ? ' own' : ''}${on ? ' on' : ''}`}
            disabled={!owned}
            aria-pressed={on}
            aria-label={WEAPONS[id].name}
            onClick={() => equipWeapon(id)}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
