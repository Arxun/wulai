import { useEffect, useState } from 'react';
import { moveOf } from './skills';
import { HERO_NAME } from '../../config/lore';
import { LEVEL_MAX, POTIONS, combat, liveStats, usePotion } from './stores/combatStore';

/**
 * 人物信息：头像 + 血蓝 + 等级经验 + 攻防武器 + Q 键血药（位于 MapHudHeader 下方）。
 * 100ms 读一次 combatStore，和右上角氮气面板同一套路。
 * 点头像打开系统菜单。PC 也可以按 Esc。见 SystemMenu.jsx。
 */

/** 头部特写：圆顺黑发、大号黑墨镜。点一下打开系统菜单 */
function Avatar({ onOpen, mobileCompact }) {
  return (
    <button
      type="button"
      className="av"
      aria-label={`${HERO_NAME} · 打开系统菜单`}
      title={mobileCompact ? '系统菜单' : '系统菜单（Esc）'}
      onClick={onOpen}
    >
      <svg viewBox="0 0 64 64" aria-hidden>
        <defs>
          <linearGradient id="av-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4a5d6e" />
            <stop offset="1" stopColor="#222c36" />
          </linearGradient>
          <linearGradient id="av-skin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#efc29c" />
            <stop offset="1" stopColor="#c99272" />
          </linearGradient>
          <linearGradient id="av-lens" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a2f3a" />
            <stop offset="1" stopColor="#07080b" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#av-bg)" />
        {/* 耳朵 + 脸 */}
        <ellipse cx="12.5" cy="37" rx="3.2" ry="4.6" fill="#c99272" />
        <ellipse cx="51.5" cy="37" rx="3.2" ry="4.6" fill="#c99272" />
        <path d="M13 30 C13 13 51 13 51 30 V38 C51 51 42 58 32 58 C22 58 13 51 13 38 Z" fill="url(#av-skin)" />
        {/* 头发：整块圆顶 + 斜刘海 */}
        <path
          d="M11 35 C9 15 20 6 33 6 C46 6 55 15 53 35 C52 28 49 24 45 22 C38 25 27 26 18 22 C15 25 12 29 11 35 Z"
          fill="#16110d"
        />
        <path d="M20 13 C25 9 33 8.5 39 10" stroke="#3a2e26" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* 墨镜 */}
        <path d="M14 33 L11.5 32 M50 33 L52.5 32" stroke="#0c0d11" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="14" y="29" width="16" height="11" rx="3.5" fill="url(#av-lens)" stroke="#0c0d11" strokeWidth="1" />
        <rect x="34" y="29" width="16" height="11" rx="3.5" fill="url(#av-lens)" stroke="#0c0d11" strokeWidth="1" />
        <path d="M30 32 Q32 30.8 34 32" stroke="#0c0d11" strokeWidth="1.6" fill="none" />
        <path d="M17 31.5 L21 37 M37 31.5 L41 37" stroke="#fff" strokeOpacity="0.32" strokeWidth="1.3" strokeLinecap="round" />
        {/* 嘴 */}
        <path d="M27.5 48.5 Q32 51 36.5 48" stroke="#7a3d2e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function CdChip({ name, cd }) {
  if (cd <= 0) return null;
  return (
    <span className="chud-cd">
      {name} {Math.ceil(cd)}s
    </span>
  );
}

export default function CombatHud({ mobileCompact = false, onOpenMenu }) {
  const [tick, setTick] = useState(0);
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);
  const s = liveStats();
  const hp = s.maxHp ? combat.hp / s.maxHp : 0;
  const mp = s.maxMp ? combat.mp / s.maxMp : 0;
  const xp = s.xpNeed ? combat.xp / s.xpNeed : 1;
  const quickPot = POTIONS[combat.quickPot] || POTIONS.hp;
  const quickCount = combat.pots[quickPot.id] || 0;
  void tick;

  return (
    <div
      className={`chud${combat.hurt > 0 ? ' hit' : ''}${combat.dead ? ' down' : ''}${
        folded ? ' chud--folded' : ''
      }${mobileCompact ? ' chud--mobile' : ''}`}
    >
      <Avatar onOpen={onOpenMenu} mobileCompact={mobileCompact} />
      <div className="chud-main">
        <button
          type="button"
          className="chud-fold-toggle"
          aria-expanded={!folded}
          onClick={() => setFolded((f) => !f)}
        >
          {!folded ? (
            <>
              <b>{HERO_NAME}</b>
              <span>
                Lv.{combat.level}
                {combat.level >= LEVEL_MAX ? ' MAX' : ''}
              </span>
            </>
          ) : (
            <span className="chud-fold-toggle__hint">人物</span>
          )}
          <span className="chud-fold-toggle__chev" aria-hidden>
            {folded ? '▸' : '▾'}
          </span>
        </button>
        <div className="chud-bars">
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
            {folded && (
              <em className="chud-xp-label">
                {combat.level >= LEVEL_MAX
                  ? `Lv.${combat.level} MAX`
                  : `Lv.${combat.level} · ${Math.floor(combat.xp)}/${s.xpNeed}`}
              </em>
            )}
          </div>
        </div>
        {!folded && (
          <div className="chud-extra">
            <div className="chud-meta">
              <span>攻 {s.atk}</span>
              <span>防 {s.def}</span>
              <span className="chud-wep">{s.weaponName}</span>
            </div>
            {!mobileCompact && (combat.whirlCd > 0 || combat.wulaiCd > 0) && (
              <div className="chud-cds">
                <CdChip name={moveOf('whirl').name} cd={combat.whirlCd} />
                <CdChip name={moveOf('wulai').name} cd={combat.wulaiCd} />
              </div>
            )}
          </div>
        )}
      </div>
      {!mobileCompact && !folded && (
        <div className="chud-side">
          <div className="chud-pots">
            <b
              className={`hp${quickCount ? ' own' : ''}`}
              title={`${quickPot.name} · 回血 +${quickPot.hp}（点头像在背包里换）`}
              onClick={() => usePotion()}
            >
              Q {quickPot.name} ×{quickCount}
            </b>
          </div>
        </div>
      )}
    </div>
  );
}
