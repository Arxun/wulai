import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import FacetMesh from '../../../lib/components/FacetMesh';
import { makeBlobGeometry } from '../../../lib/geometry/organic';
import { makeLoftGeometry } from '../../../lib/geometry/loft';
import { pivotGeometry, sub3 } from '../../../lib/geometry/pivot';
import { fabricTextures, skinTextures } from '../../../lib/textures/procedural';
import Hand from './Hand';
import HeldWeapon from '../../game/equipment/weapons';
import { WEAPON_DEFS } from '../../game/equipment/weaponDefs';
import { combat, world } from '../../game/stores/combatStore';
import { C } from './palette';
import { IDLE_RIG } from './rigs';

/**
 * 双手通道：pose.arms[右, 左] 的 shoulder / elbow / yaw / roll。
 *
 * 出招时两只手用同一套握法：掌心套在杆上，杆从拳孔穿过。
 * 右手插槽写死在掌心；左手 IK 够到第二握点后，按同一套偏移把掌心锁上去。
 */

const v3 = (a) => new THREE.Vector3(...a);
const mid = (a, b, t = 0.5) => v3(a).lerp(v3(b), t).toArray();

const _tgt = new THREE.Vector3();
const _sh = new THREE.Vector3();
const _to = new THREE.Vector3();
const _n = new THREE.Vector3();
const _bin = new THREE.Vector3();
const _elb = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _mWorld = new THREE.Matrix4();
const _mLocal = new THREE.Matrix4();
const _mParent = new THREE.Matrix4();
const _scl = new THREE.Vector3();

/** 掌心握孔。站着杖尖朝下；出招两掌叠在握把上，杖尖朝前好挥。 */
const PALM = [0.028, 0, -0.012];
const HANG_ROT = [Math.PI + 0.04, 0.04, 0.06];
const GRASP_ROT = [0.28, 0.12, 0.18];
const GRASP_HAND = [0.22, 0.52, 1.12];

function slotInv(rot) {
  return new THREE.Matrix4()
    .compose(new THREE.Vector3(...PALM), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1))
    .invert();
}
const _graspInv = slotInv(GRASP_ROT);

function weaponSpec() {
  return WEAPON_DEFS[combat.weapon] || WEAPON_DEFS.wood;
}

function twoHanding() {
  const spec = weaponSpec();
  if (!spec.twoHand) return false;
  return world.swing > 0 || world.heavy > 0 || world.lock;
}

/** 左臂两骨 IK：肘向外撑，手再顺着杆把拳心套上去。 */
function gripLeftToStaff(left, grip) {
  const upper = left.upper;
  const fore = left.fore;
  if (!upper || !fore || !grip || !upper.parent) return;
  const parent = upper.parent;
  const L1 = left.L1;
  const L2 = left.L2;
  if (!L1 || !L2) return;

  grip.getWorldPosition(_tgt);
  parent.worldToLocal(_tgt);
  _sh.copy(upper.position);
  _to.copy(_tgt).sub(_sh);
  const maxD = L1 + L2 - 0.1;
  const minD = Math.abs(L1 - L2) + 0.08;
  const d = THREE.MathUtils.clamp(_to.length(), minD, maxD);
  if (_to.lengthSq() < 1e-8) return;
  _to.setLength(d);
  _n.copy(_to).normalize();

  _pole.set(_sh.x + 0.72, _sh.y - 0.28, _sh.z + 0.42);
  _bin.crossVectors(_n, _pole.sub(_sh));
  _bin.cross(_n);
  if (_bin.lengthSq() < 1e-5) _bin.set(0, 0, 1);
  _bin.normalize();
  const midLen = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - midLen * midLen));
  _elb.copy(_sh).addScaledVector(_n, midLen).addScaledVector(_bin, h);

  _n.copy(_elb).sub(_sh).normalize();
  _q.setFromUnitVectors(left.restUpper, _n);
  upper.quaternion.copy(_q);

  grip.getWorldPosition(_tgt);
  upper.worldToLocal(_tgt);
  _to.copy(_tgt).sub(fore.position);
  if (_to.lengthSq() < 1e-8) return;
  _q.setFromUnitVectors(left.restFore, _to.normalize());
  fore.quaternion.copy(_q);
  upper.updateWorldMatrix(true, false);
  fore.updateWorldMatrix(true, false);

  if (left.hand && grip) snapPalmToGrip(left.hand, grip, _graspInv);
}

/** 左手掌心叠到第二握点，和右手用同一套拳孔。 */
function snapPalmToGrip(hand, grip, inv) {
  if (!hand?.parent) return;
  grip.updateWorldMatrix(true, false);
  hand.parent.updateWorldMatrix(true, false);
  _mWorld.multiplyMatrices(grip.matrixWorld, inv);
  _mParent.copy(hand.parent.matrixWorld).invert();
  _mLocal.multiplyMatrices(_mParent, _mWorld);
  _mLocal.decompose(_tgt, _q, _scl);
  hand.position.copy(_tgt);
  hand.quaternion.copy(_q);
}

/** 在 a→b 方向上，从 b 再向外延伸 len */
const extend = (a, b, len) => v3(b).add(v3(b).sub(v3(a)).normalize().multiplyScalar(len)).toArray();

/** 圆形徽章：贴在上臂外侧，跟着上臂一起摆 */
function Patch({ at }) {
  return (
    <group position={at}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.014, 12]} />
        <meshStandardMaterial color="#7b1e18" roughness={0.6} flatShading />
      </mesh>
      <mesh position={[0.008, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.027, 0.027, 0.006, 12]} />
        <meshStandardMaterial color="#c0b6a8" roughness={0.5} flatShading />
      </mesh>
    </group>
  );
}

function Arm({ joints, jointRef }) {
  const { shoulder, elbow, wrist, radii, handRot, stick, patch, seed } = joints;
  const tex = useMemo(() => fabricTextures('ripstop'), []);
  const skin = useMemo(() => skinTextures({ ruddy: 0.12 }), []);

  const g = useMemo(() => {
    const cuffEnd = extend(elbow, wrist, 0.05);
    return {
      upper: pivotGeometry(
        makeLoftGeometry({
          keys: [
            { p: shoulder, a: radii[0] },
            { p: mid(shoulder, elbow, 0.5), a: radii[1] },
            { p: elbow, a: radii[2] },
          ],
          samples: 7,
          segments: 9,
          bumps: { count: 3, amount: 0.05, phase: 0.25 },
          jitter: 0.012,
          color: C.jacket,
          faceTint: 0.045,
          uvMeters: 0.07,
          seed,
        }),
        shoulder,
      ),
      fore: pivotGeometry(
        makeLoftGeometry({
          keys: [
            { p: elbow, a: radii[2] },
            { p: mid(elbow, wrist, 0.5), a: radii[3] },
            { p: wrist, a: radii[4] },
            { p: cuffEnd, a: radii[4] * 0.97 },
          ],
          samples: 7,
          segments: 9,
          caps: false,
          bumps: { count: 2, amount: 0.04, phase: 0.25 },
          jitter: 0.012,
          color: (t) => (t > 0.86 ? C.jacketDark : C.jacket),
          faceTint: 0.045,
          uvMeters: 0.07,
          seed: seed + 1,
        }),
        elbow,
      ),
      wristSkin: pivotGeometry(
        makeLoftGeometry({
          keys: [
            { p: extend(elbow, wrist, 0.02), a: radii[4] * 0.9 },
            { p: extend(elbow, wrist, 0.085), a: radii[4] * 0.8 },
          ],
          samples: 6,
          segments: 16,
          smooth: true,
          color: C.skin,
          faceTint: 0.012,
          uvMeters: 0.07,
          seed: seed + 5,
        }),
        elbow,
      ),
      shoulderCap: makeBlobGeometry({ radius: radii[0], detail: 2, jitter: 0.035, color: C.jacket, seed }),
      elbowCap: makeBlobGeometry({ radius: radii[2] * 1.06, detail: 1, jitter: 0.035, color: C.jacket, seed: seed + 2 }),
      hand: extend(elbow, wrist, 0.073),
      patchAt: sub3(mid(shoulder, elbow, 0.42), shoulder).map((v, i) => v + [0.083 * Math.sign(shoulder[0] || 1), 0, 0.02][i]),
    };
  }, [shoulder, elbow, wrist, radii, seed]);

  const rest = useMemo(
    () => ({
      L1: v3(elbow).distanceTo(v3(shoulder)),
      L2: v3(g.hand).distanceTo(v3(elbow)),
      restUpper: new THREE.Vector3(...sub3(elbow, shoulder)).normalize(),
      restFore: new THREE.Vector3(...sub3(g.hand, elbow)).normalize(),
    }),
    [shoulder, elbow, g.hand],
  );

  const refs = useRef({});
  refs.current.L1 = rest.L1;
  refs.current.L2 = rest.L2;
  refs.current.restUpper = rest.restUpper;
  refs.current.restFore = rest.restFore;
  refs.current.handRest = sub3(g.hand, elbow);
  refs.current.handRot = handRot;
  jointRef(refs);

  return (
    <group position={shoulder} ref={(r) => { refs.current.upper = r; }}>
      <FacetMesh geometry={g.shoulderCap} roughness={0.55} />
      <FacetMesh geometry={g.upper} side={2} roughness={0.5} texture={tex} bumpScale={0.8} />
      <FacetMesh geometry={g.elbowCap} position={sub3(elbow, shoulder)} roughness={0.55} />
      {patch && <Patch at={g.patchAt} />}
      <group position={sub3(elbow, shoulder)} ref={(r) => { refs.current.fore = r; }}>
        <FacetMesh geometry={g.fore} side={2} roughness={0.5} texture={tex} bumpScale={0.8} />
        <FacetMesh geometry={g.wristSkin} roughness={0.7} texture={skin} bumpScale={0.3} smooth />
        <group
          position={sub3(g.hand, elbow)}
          rotation={handRot}
          ref={(r) => { refs.current.hand = r; }}
        >
          <Hand />
          {stick && (
            <group
              ref={(r) => { refs.current.weaponSlot = r; }}
              position={PALM}
              rotation={HANG_ROT}
            >
              <HeldWeapon />
              <group ref={(r) => { refs.current.leftGrip = r; }} position={[0, 0.062, 0]} />
            </group>
          )}
        </group>
      </group>
    </group>
  );
}

export default function Arms({ rig = IDLE_RIG.arms, poseRef }) {
  const joints = useRef([]);
  useFrame(() => {
    const pose = poseRef?.current;
    if (!pose) return;
    const spec = weaponSpec();
    const hold = twoHanding();
    const right = joints.current[0]?.current;
    if (right?.leftGrip && spec.offHand) {
      right.leftGrip.position.set(spec.offHand[0], spec.offHand[1], spec.offHand[2]);
    }
    for (let i = 0; i < joints.current.length; i++) {
      const r = joints.current[i]?.current;
      const a = pose.arms[i];
      if (!r || !a) continue;
      const sw = world.lock || world.swing > 0 || world.heavy > 0 || Math.abs(a.shoulder) > 1 ? 1 : (rig[i].swing ?? 1);
      if (r.upper) r.upper.rotation.set(-a.shoulder * sw, a.yaw ?? 0, a.roll ?? 0);
      if (r.fore) r.fore.rotation.set(-a.elbow * (0.35 + 0.65 * sw), 0, 0);
      if (r.hand && !hold) {
        const hr = r.handRot || rig[i].handRot || [0, 0, 0];
        const hp = r.handRest;
        r.hand.rotation.set(hr[0], hr[1], hr[2]);
        if (hp) r.hand.position.set(hp[0], hp[1], hp[2]);
      }
    }
    if (right?.weaponSlot) {
      const rot = hold ? GRASP_ROT : HANG_ROT;
      right.weaponSlot.rotation.set(rot[0], rot[1], rot[2]);
    }
    if (hold && right?.hand) {
      right.hand.rotation.set(GRASP_HAND[0], GRASP_HAND[1], GRASP_HAND[2]);
      const hp = right.handRest;
      if (hp) right.hand.position.set(hp[0], hp[1], hp[2]);
    }
    if (hold) {
      const left = joints.current[1]?.current;
      if (right?.leftGrip && left) gripLeftToStaff(left, right.leftGrip);
    }
  });

  return (
    <group>
      {rig.map((arm, i) => (
        <Arm key={i} joints={arm} jointRef={(r) => { joints.current[i] = r; }} />
      ))}
    </group>
  );
}
