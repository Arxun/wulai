/**
 * 把"按世界坐标建好的几何体"改造成"可绕某个关节旋转的几何体"。
 *
 * 本项目的放样几何体都是直接写世界坐标的（肩在 y=1.275、髋在 y=0.72……），
 * 这样建模直观，但没法旋转——绕原点转会把整条腿甩到脚底下去。
 * 做法：把几何体平移 -pivot，再放进 `<group position={pivot} rotation={...}>`，
 * 旋转中心就落在关节上，而中立姿态下的世界位置和改造前完全一致。
 */
export function pivotGeometry(geom, pivot) {
  geom.translate(-pivot[0], -pivot[1], -pivot[2]);
  return geom;
}

/** a - b */
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** 取反 */
export const neg3 = (a) => [-a[0], -a[1], -a[2]];
