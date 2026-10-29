import { MONSTER_KINDS } from './kinds';

/** 悬停判定比受击半径略宽，方便剑尖对准身体 */
const PICK_PAD = 1.35;

/**
 * 射线到竖直线段的最近距离。射线参数 sc < 0 视为打不中。
 * 不分配对象，给鼠标移动用。
 */
function raySegmentHit(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, radius) {
  const vx = bx - ax;
  const vy = by - ay;
  const vz = bz - az;
  const wx = ox - ax;
  const wy = oy - ay;
  const wz = oz - az;
  const a = dx * dx + dy * dy + dz * dz;
  const b = dx * vx + dy * vy + dz * vz;
  const c = vx * vx + vy * vy + vz * vz;
  const d = dx * wx + dy * wy + dz * wz;
  const e = vx * wx + vy * wy + vz * wz;
  const denom = a * c - b * b;
  let sN;
  let sD = denom;
  let tN;
  let tD = denom;

  if (c < 1e-8) {
    sN = -d;
    sD = a;
    tN = 0;
    tD = 1;
  } else if (denom < 1e-8) {
    sN = 0;
    sD = 1;
    tN = e;
    tD = c;
  } else {
    sN = b * e - c * d;
    tN = a * e - b * d;
    if (sN < 0) {
      sN = 0;
      tN = e;
      tD = c;
    }
  }

  if (tN < 0) {
    tN = 0;
    if (-d < 0) sN = 0;
    else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0) sN = 0;
    else {
      sN = -d + b;
      sD = a;
    }
  }

  if (sN < 0) return null;
  const sc = sD === 0 ? 0 : sN / sD;
  const tc = tD === 0 ? 0 : tN / tD;
  const px = ox + sc * dx - (ax + tc * vx);
  const py = oy + sc * dy - (ay + tc * vy);
  const pz = oz + sc * dz - (az + tc * vz);
  if (px * px + py * py + pz * pz > radius * radius) return null;
  return sc;
}

/**
 * 鼠标射线打中的最近一只活怪。死掉或淡出的不算。
 * @param {Array<{ kind: string, x: number, y: number, z: number, hp: number, dead: boolean }>} monsters
 */
export function pickMonsterOnRay(ox, oy, oz, dx, dy, dz, monsters) {
  let best = null;
  let bestT = Infinity;
  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i];
    if (m.dead || m.hp <= 0) continue;
    const spec = MONSTER_KINDS[m.kind];
    if (!spec) continue;
    const scale = spec.scale || 1;
    const radius = (spec.radius || 0.5) * scale * PICK_PAD;
    const y1 = m.y + (spec.hpY || 1) * scale;
    const t = raySegmentHit(ox, oy, oz, dx, dy, dz, m.x, m.y, m.z, m.x, y1, m.z, radius);
    if (t != null && t < bestT) {
      bestT = t;
      best = m;
    }
  }
  return best;
}
