/**
 * 武器数据（不含网格）。
 * 网格在 weapons.jsx，按 id 对上就行。
 *
 * twoHand / offHand：双手武器出招时，左手 IK 抓的第二握点（武器本地坐标，+Y 朝刃尖）。
 * 以后换刀剑：这里加一项，weapons.jsx 加对应模型，combatStore 的 WEAPONS 登记属性。
 */
export const WEAPON_DEFS = {
  wood: { twoHand: true, offHand: [0, 0.062, 0] },
  iron: { twoHand: true, offHand: [0, 0.065, 0] },
  frost: { twoHand: true, offHand: [0, 0.06, 0] },
  ember: { twoHand: true, offHand: [0, 0.065, 0] },
  storm: { twoHand: true, offHand: [0, 0.055, 0] },
  blood: { twoHand: true, offHand: [0, 0.07, 0] },
};
