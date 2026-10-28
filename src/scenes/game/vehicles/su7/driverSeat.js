/**
 * 主驾占位，与 su7-replica `Furina.ts` → `handleModel()` 一致（车模本地坐标）。
 * @see su7-replica/src/Experience/World/Furina.ts
 */

/** glTF 原始朝向：车头沿 +X；游戏 / 小武前进为 +Z，网格层绕 Y 补这一角 */
export const SU7_MESH_YAW = -Math.PI / 2;

/** 主驾锚点：与 Furina 相同 glTF 本地坐标（bust 挂在 SU7_MESH_YAW 子树内） */
export const SU7_DRIVER_LOCAL = {
  x: 0.025, // 0.225 − 0.2，主驾略靠后
  y: 0.3,
  z: -0.4,
  rotY: Math.PI * 0.5,
};
