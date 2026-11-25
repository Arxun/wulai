import { useEffect, useLayoutEffect, useState } from 'react';
import { SKILL_BINDS } from './skills/binds';
import {
  POTION_ORDER,
  POTIONS,
  WEAPON_ORDER,
  WEAPONS,
  combat,
  equipWeapon,
  liveStats,
  setQuickPotion,
  unequipWeapon,
  usePotion,
  world,
} from './stores/combatStore';

/**
 * 全屏系统菜单，从左侧滑入。目前只有背包：
 *   装备和道具用标签切换，格子保持固定大小，有多少排多少，多了在左侧滚；
 *   右侧介绍栏从顶到底。点一格后在这里装备 / 卸下，或者服用 / 设为 Q 键。
 *
 * 挂在 GameHud 里，移动端跟着整页旋转。按钮用 onClick，不能放进 HOLD_ZONES。
 * 打开时 world.paused，人物、怪物、载具停在这一帧；关掉才继续。
 * 只有打开时才每 150ms 看一眼背包，内容没变就不重渲染。
 */

const TABS = [
  { id: 'bag', label: '背包' },
  { id: 'skill', label: '技能' },
];

function bagSignature() {
  let sig = `${combat.weapon}|${combat.quickPot}|${combat.level}|${Math.ceil(combat.hp)}|${combat.dead ? 1 : 0}|`;
  for (const id of WEAPON_ORDER) sig += combat.owned[id] ? '1' : '0';
  for (const id of POTION_ORDER) sig += `|${combat.pots[id] || 0}`;
  return sig;
}

function ownedItems() {
  const list = [];
  for (const id of WEAPON_ORDER) {
    if (combat.owned[id]) list.push({ kind: 'weapon', id });
  }
  for (const id of POTION_ORDER) {
    const count = combat.pots[id] || 0;
    if (count > 0) list.push({ kind: 'potion', id, count });
  }
  return list;
}

function itemKey(it) {
  return it ? `${it.kind}:${it.id}` : '';
}

const BAG_TABS = [
  { id: 'gear', label: '装备' },
  { id: 'item', label: '道具' },
];

/** 每种武器一个剪影，药共用瓶形，颜色用 --c。只在菜单打开时挂上，不进每帧。 */
const WEAPON_ICON = {
  wood: 'M14 2h4v3h-1.2v22h-1.6V5H14V2z',
  iron: 'M15 2h2v20h3v2h-8v-2h3V10L9 6.5 10.2 5 15 8.2V2z',
  frost: 'M14.2 12h3.6v16h-3.6V12zM16 2l4 6h-3v3h-2V8H12l4-6z',
  ember: 'M14 11h4v17h-4V11zM16 1l6 11h-4.2L16 8.5 14.2 12H10L16 1z',
  storm: 'M8 3h3l9 8-2 2-3-2.2L11 26h-3l4.2-13L8 15.2 6 13.2 8 3z',
  blood: 'M14 2h4l1 14h3v3h-3.2L17 28h-2l-1.8-9H10v-3h3L14 2zM11 8h2v3h-2V8zM19 12h2v3h-2v-3z',
};

function ItemIcon({ kind, id }) {
  const d = kind === 'potion'
    ? 'M13 2h6v4h-1l1 3.2c2.4 1.2 4 3.6 4 6.3 0 4-3.1 7.5-7 7.5s-7-3.5-7-7.5c0-2.7 1.6-5.1 4-6.3L14 6h-1V2z'
    : WEAPON_ICON[id] || WEAPON_ICON.wood;
  return (
    <svg className="sysmenu-icon" viewBox="0 0 32 32" aria-hidden>
      <path fill="currentColor" d={d} />
    </svg>
  );
}

function BagScreen() {
  const [sig, setSig] = useState(bagSignature);
  const [bagTab, setBagTab] = useState(BAG_TABS[0].id);
  const [selected, setSelected] = useState(() => itemKey(ownedItems()[0]));
  useEffect(() => {
    const id = setInterval(() => setSig(bagSignature()), 150);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const items = ownedItems();
    setSelected((cur) => {
      if (items.some((it) => itemKey(it) === cur)) return cur;
      const pool = items.filter((it) => it.kind === (bagTab === 'gear' ? 'weapon' : 'potion'));
      return itemKey(pool[0] || items[0]);
    });
  }, [sig, bagTab]);

  const refresh = () => setSig(bagSignature());
  const items = ownedItems();
  const weapons = items.filter((it) => it.kind === 'weapon');
  const potions = items.filter((it) => it.kind === 'potion');
  const current = items.find((it) => itemKey(it) === selected) || null;
  const s = liveStats();
  const equipped = WEAPONS[combat.weapon];
  const quick = POTIONS[combat.quickPot];
  const quickCount = quick ? combat.pots[quick.id] || 0 : 0;
  const hpFull = combat.hp >= s.maxHp - 0.5;

  const selectKey = (key) => () => setSelected(key);

  const shown = bagTab === 'gear' ? weapons : potions;

  return (
    <div className="sysmenu__stage">
      <div className="sysmenu__main">
        <section className="sysmenu__equip" aria-label="当前装备">
          <div className="sysmenu-slots">
            <button
              type="button"
              className={`sysmenu-cell${equipped ? '' : ' empty'}${selected === `weapon:${equipped?.id}` ? ' on' : ''}`}
              style={equipped ? { '--c': equipped.color } : undefined}
              aria-label={equipped ? `装备 ${equipped.name}` : '装备 未装备'}
              title={equipped ? equipped.name : '未装备'}
              onClick={equipped ? selectKey(`weapon:${equipped.id}`) : undefined}
            >
              {equipped ? <ItemIcon kind="weapon" id={equipped.id} /> : <span className="sysmenu-cell__empty">空</span>}
              <i>装备</i>
            </button>
            <button
              type="button"
              className={`sysmenu-cell${quickCount ? '' : ' empty'}${selected === `potion:${quick?.id}` ? ' on' : ''}`}
              style={quickCount ? { '--c': quick.color } : undefined}
              aria-label={quickCount ? `快捷键 ${quick.name}` : '快捷键 未设置'}
              title={quickCount ? `${quick.name} ×${quickCount}` : '没有可喝的药'}
              onClick={quickCount ? selectKey(`potion:${quick.id}`) : undefined}
            >
              {quickCount ? <ItemIcon kind="potion" id={quick.id} /> : <span className="sysmenu-cell__empty">空</span>}
              <i>Q</i>
            </button>
          </div>
          <dl className="sysmenu-stats">
            <div>
              <dt>等级</dt>
              <dd>{combat.level}</dd>
            </div>
            <div>
              <dt>生命</dt>
              <dd>
                {Math.ceil(combat.hp)}/{s.maxHp}
              </dd>
            </div>
            <div>
              <dt>攻击</dt>
              <dd>{s.atk}</dd>
            </div>
            <div>
              <dt>防御</dt>
              <dd>{s.def}</dd>
            </div>
          </dl>
        </section>
        <div className="sysmenu__bags">
          <div className="sysmenu__bagtabs" role="tablist" aria-label="背包分类">
            {BAG_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={bagTab === t.id}
                className={`sysmenu__tab${bagTab === t.id ? ' on' : ''}`}
                onClick={() => setBagTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="sysmenu__grid" aria-label={bagTab === 'gear' ? '装备' : '道具'}>
            {bagTab === 'gear' &&
              shown.map((it) => {
                const w = WEAPONS[it.id];
                const on = selected === itemKey(it);
                const worn = combat.weapon === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`sysmenu-cell${on ? ' on' : ''}`}
                    style={{ '--c': w.color }}
                    aria-pressed={on}
                    aria-label={w.name}
                    title={w.name}
                    onClick={selectKey(itemKey(it))}
                  >
                    <ItemIcon kind="weapon" id={it.id} />
                    {worn && <i>装</i>}
                  </button>
                );
              })}
            {bagTab === 'item' &&
              shown.map((it) => {
                const p = POTIONS[it.id];
                const on = selected === itemKey(it);
                const bound = combat.quickPot === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`sysmenu-cell${on ? ' on' : ''}`}
                    style={{ '--c': p.color }}
                    aria-pressed={on}
                    aria-label={`${p.name} ×${it.count}`}
                    title={`${p.name} ×${it.count}`}
                    onClick={selectKey(itemKey(it))}
                  >
                    <ItemIcon kind="potion" id={it.id} />
                    <em>×{it.count}</em>
                    {bound && <i>Q</i>}
                  </button>
                );
              })}
            {shown.length === 0 && <p className="sysmenu__empty">{bagTab === 'gear' ? '还没有装备' : '还没有道具'}</p>}
          </div>
        </div>
      </div>

      <aside className="sysmenu__detail" aria-label="物品介绍">
          {!current && <p className="sysmenu__empty">选择一件物品</p>}
          {current?.kind === 'weapon' && (
            <WeaponDetail
              id={current.id}
              onEquip={() => {
                if (equipWeapon(current.id)) refresh();
              }}
              onUnequip={() => {
                if (unequipWeapon()) refresh();
              }}
            />
          )}
          {current?.kind === 'potion' && (
            <PotionDetail
              id={current.id}
              count={current.count}
              hpFull={hpFull}
              onUse={() => {
                if (usePotion(current.id)) refresh();
              }}
              onQuick={() => {
                if (setQuickPotion(current.id)) refresh();
              }}
            />
          )}
      </aside>
    </div>
  );
}

function SkillScreen({ pc }) {
  const [id, setId] = useState(SKILL_BINDS[0].id);
  const cur = SKILL_BINDS.find((s) => s.id === id) || SKILL_BINDS[0];
  return (
    <div className="sysmenu__stage">
      <div className="sysmenu__main">
        <div className="sysmenu__bags">
          <p className="sysmenu__skill-note">
            {pc ? '现在是电脑。手机那一列是屏幕上的按钮，不是键盘。' : '现在是手机。电脑那一列是键盘。'}
          </p>
          <div className="sysmenu-skills" aria-label="技能">
            {SKILL_BINDS.map((s) => {
              const on = s.id === cur.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`sysmenu-skill${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setId(s.id)}
                >
                  <b>{s.name}</b>
                  <span className={`sysmenu-skill__key${pc ? ' here' : ''}`}>
                    <i>电脑</i>
                    {s.pc}
                  </span>
                  <span className={`sysmenu-skill__key${pc ? '' : ' here'}`}>
                    <i>手机</i>
                    {s.mobile}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <aside className="sysmenu__detail" aria-label="技能介绍">
        <p className="sysmenu__kind">技能</p>
        <h3>{cur.name}</h3>
        <p className="sysmenu__stat">{cur.mp > 0 ? `消耗蓝 ${cur.mp}` : '不耗蓝'}</p>
        {cur.cd > 0 && <p className="sysmenu__stat">冷却 {cur.cd} 秒</p>}
        <p className="sysmenu__desc">{cur.desc}</p>
        <dl className="sysmenu-skill__binds">
          <div className={pc ? 'here' : ''}>
            <dt>电脑</dt>
            <dd>{cur.pc}</dd>
          </div>
          <div className={pc ? '' : 'here'}>
            <dt>手机</dt>
            <dd>{cur.mobile}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function WeaponDetail({ id, onEquip, onUnequip }) {
  const w = WEAPONS[id];
  const worn = combat.weapon === id;
  return (
    <>
      <p className="sysmenu__kind">装备</p>
      <h3 style={{ color: w.color }}>{w.name}</h3>
      <p className="sysmenu__stat">攻击 +{w.atk}</p>
      <p className="sysmenu__desc">{w.desc}</p>
      <div className="sysmenu__actions">
        <button type="button" disabled={worn} onClick={onEquip}>
          {worn ? '已装备' : '装备'}
        </button>
        <button type="button" disabled={!worn} onClick={onUnequip}>
          卸下
        </button>
      </div>
    </>
  );
}

function PotionDetail({ id, count, hpFull, onUse, onQuick }) {
  const p = POTIONS[id];
  const bound = combat.quickPot === id;
  const cantDrink = combat.dead || hpFull;
  return (
    <>
      <p className="sysmenu__kind">丹药 · 持有 {count}</p>
      <h3 style={{ color: p.color }}>{p.name}</h3>
      <p className="sysmenu__stat">恢复 {p.hp} 点生命</p>
      <p className="sysmenu__desc">{p.desc}</p>
      <div className="sysmenu__actions">
        <button type="button" disabled={cantDrink} onClick={onUse}>
          {combat.dead ? '无法服用' : hpFull ? '生命已满' : '服用'}
        </button>
        <button type="button" disabled={bound} onClick={onQuick}>
          {bound ? '已设为 Q 键' : '设为快捷键'}
        </button>
      </div>
    </>
  );
}

export default function SystemMenu({ onClose, pc = false }) {
  const [tab, setTab] = useState(TABS[0].id);

  useLayoutEffect(() => {
    world.paused = true;
    const html = document.documentElement;
    html.classList.add('sysmenu-open');
    return () => {
      world.paused = false;
      html.classList.remove('sysmenu-open');
    };
  }, []);

  return (
    <div className="sysmenu" role="dialog" aria-modal="true" aria-label="系统菜单">
      <div className="sysmenu__page">
        <header className="sysmenu__head">
          <b className="sysmenu__title">系统</b>
          <span className="sysmenu__pause">战斗已暂停</span>
          <div className="sysmenu__tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`sysmenu__tab${tab === t.id ? ' on' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {pc && <span className="sysmenu__hint">Esc 关闭</span>}
          <button type="button" className="sysmenu__close" aria-label="关闭系统菜单" onClick={onClose}>
            关闭
          </button>
        </header>
        {tab === 'bag' && <BagScreen />}
        {tab === 'skill' && <SkillScreen pc={pc} />}
      </div>
    </div>
  );
}
