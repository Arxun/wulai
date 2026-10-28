import FacetMesh from '../../lib/components/FacetMesh';
import { makeBlobGeometry } from '../../lib/geometry/organic';
import { makeLoftGeometry } from '../../lib/geometry/loft';

/**
 * 五种怪的低多边形零件。每种一份几何，所有个体共用。
 */

function loft(keys, color, seed, extra = {}) {
  return makeLoftGeometry({
    keys,
    samples: extra.samples ?? 6,
    segments: extra.segments ?? 6,
    color,
    jitter: extra.jitter ?? 0.035,
    seed,
  });
}

export function makeMonsterGeo() {
  return {
    pebble: {
      shell: makeBlobGeometry({ radius: 0.34, detail: 1, scale: [1.5, 0.5, 1.22], jitter: 0.15, color: '#6f6b61', seed: 501 }),
      plate: makeBlobGeometry({ radius: 0.2, detail: 1, scale: [1.55, 0.28, 1.05], jitter: 0.1, color: '#8b8478', seed: 502 }),
      claw: makeBlobGeometry({ radius: 0.12, detail: 0, scale: [1.5, 0.4, 0.7], jitter: 0.1, color: '#9a8f7c', seed: 503 }),
      pincer: makeBlobGeometry({ radius: 0.065, detail: 0, scale: [0.65, 0.32, 1.45], jitter: 0.07, color: '#c4b392', seed: 504 }),
      eye: makeBlobGeometry({ radius: 0.042, detail: 0, scale: [1.1, 1.1, 0.9], jitter: 0.03, color: '#1a1410', seed: 505 }),
      leg: loft(
        [
          { p: [0, 0.1, 0], a: 0.032 },
          { p: [0.18, 0.06, 0.03], a: 0.026 },
          { p: [0.3, 0.01, 0.01], a: 0.02 },
        ],
        '#7a746a',
        506,
        { samples: 5, segments: 5 },
      ),
    },
    fox: {
      body: makeBlobGeometry({ radius: 0.28, detail: 1, scale: [0.78, 0.82, 1.45], jitter: 0.08, color: '#c47a3a', seed: 511 }),
      chest: makeBlobGeometry({ radius: 0.16, detail: 0, scale: [0.85, 0.75, 0.7], jitter: 0.06, color: '#e8c9a0', seed: 512 }),
      head: makeBlobGeometry({ radius: 0.16, detail: 1, scale: [0.95, 0.9, 1.05], jitter: 0.06, color: '#c47a3a', seed: 513 }),
      muzzle: makeBlobGeometry({ radius: 0.07, detail: 0, scale: [0.7, 0.55, 1.35], jitter: 0.05, color: '#e0b07a', seed: 514 }),
      nose: makeBlobGeometry({ radius: 0.028, detail: 0, scale: [1, 0.8, 0.9], jitter: 0.02, color: '#2a1c14', seed: 515 }),
      ear: makeBlobGeometry({ radius: 0.075, detail: 0, scale: [0.45, 1.55, 0.38], jitter: 0.05, color: '#c47a3a', seed: 516 }),
      inner: makeBlobGeometry({ radius: 0.04, detail: 0, scale: [0.4, 1.2, 0.28], jitter: 0.03, color: '#f0c8b0', seed: 517 }),
      tail: loft(
        [
          { p: [0, 0.22, -0.3], a: 0.09 },
          { p: [0.1, 0.4, -0.58], a: 0.07 },
          { p: [0.06, 0.52, -0.86], a: 0.028 },
        ],
        '#e0a25a',
        518,
      ),
      leg: loft(
        [
          { p: [0, 0.22, 0], a: 0.045 },
          { p: [0, 0.1, 0.02], a: 0.035 },
          { p: [0, 0.01, 0.01], a: 0.028 },
        ],
        '#a86832',
        519,
        { samples: 5, segments: 5 },
      ),
    },
    crow: {
      body: makeBlobGeometry({ radius: 0.2, detail: 1, scale: [0.72, 0.88, 1.45], jitter: 0.07, color: '#3a1a18', seed: 521 }),
      head: makeBlobGeometry({ radius: 0.1, detail: 1, scale: [0.9, 0.85, 1], jitter: 0.05, color: '#4a201c', seed: 522 }),
      beak: makeBlobGeometry({ radius: 0.055, detail: 0, scale: [0.38, 0.38, 1.85], jitter: 0.04, color: '#e0a040', seed: 523 }),
      eye: makeBlobGeometry({ radius: 0.022, detail: 0, scale: [1, 1, 0.7], jitter: 0.02, color: '#f2d060', seed: 524 }),
      wing: loft(
        [
          { p: [0.04, 0.02, 0.04], a: 0.035, b: 0.07 },
          { p: [0.36, 0.08, -0.04], a: 0.018, b: 0.18 },
          { p: [0.68, 0.02, -0.12], a: 0.006, b: 0.05 },
        ],
        '#5a2220',
        525,
      ),
      tail: loft(
        [
          { p: [0, 0.02, -0.22], a: 0.05, b: 0.03 },
          { p: [0, -0.02, -0.42], a: 0.08, b: 0.018 },
          { p: [0, -0.04, -0.58], a: 0.04, b: 0.008 },
        ],
        '#2a1210',
        526,
        { samples: 5, segments: 5 },
      ),
      leg: loft(
        [
          { p: [0, 0.08, 0], a: 0.018 },
          { p: [0, -0.12, 0.02], a: 0.014 },
          { p: [0, -0.22, 0.04], a: 0.012 },
        ],
        '#c4a050',
        527,
        { samples: 5, segments: 4 },
      ),
    },
    golem: {
      torso: makeBlobGeometry({ radius: 0.42, detail: 1, scale: [1.05, 1.15, 0.78], jitter: 0.14, color: '#6d6860', seed: 531 }),
      belly: makeBlobGeometry({ radius: 0.28, detail: 1, scale: [1.05, 0.7, 0.75], jitter: 0.12, color: '#5c5852', seed: 532 }),
      head: makeBlobGeometry({ radius: 0.2, detail: 1, scale: [1.05, 0.95, 0.85], jitter: 0.12, color: '#7a756c', seed: 533 }),
      eye: makeBlobGeometry({ radius: 0.04, detail: 0, scale: [1.2, 0.7, 0.6], jitter: 0.04, color: '#c45a28', seed: 534 }),
      moss: makeBlobGeometry({ radius: 0.12, detail: 0, scale: [1.4, 0.45, 0.9], jitter: 0.14, color: '#4a5a32', seed: 535 }),
      arm: loft(
        [
          { p: [0.38, 0.78, 0], a: 0.13 },
          { p: [0.58, 0.42, 0.08], a: 0.12 },
          { p: [0.66, 0.16, 0.12], a: 0.15 },
        ],
        '#7c776c',
        536,
      ),
      fist: makeBlobGeometry({ radius: 0.14, detail: 0, scale: [1.15, 0.85, 1], jitter: 0.1, color: '#8a8478', seed: 537 }),
      leg: loft(
        [
          { p: [0.16, 0.28, 0], a: 0.12 },
          { p: [0.18, 0.12, 0.02], a: 0.11 },
          { p: [0.16, 0.01, 0.02], a: 0.13 },
        ],
        '#5e5a54',
        538,
        { samples: 5, segments: 6 },
      ),
    },
    oni: {
      torso: makeBlobGeometry({ radius: 0.4, detail: 1, scale: [0.95, 1.25, 0.72], jitter: 0.09, color: '#6b2a28', seed: 541 }),
      sash: makeBlobGeometry({ radius: 0.22, detail: 0, scale: [1.15, 0.28, 0.85], jitter: 0.06, color: '#2a1814', seed: 542 }),
      head: makeBlobGeometry({ radius: 0.2, detail: 1, scale: [1.05, 1, 0.9], jitter: 0.07, color: '#7a322c', seed: 543 }),
      mask: makeBlobGeometry({ radius: 0.16, detail: 0, scale: [1.15, 0.82, 0.5], jitter: 0.07, color: '#1e1410', seed: 544 }),
      fang: makeBlobGeometry({ radius: 0.035, detail: 0, scale: [0.45, 1.3, 0.4], jitter: 0.04, color: '#efe6d2', seed: 545 }),
      horn: loft(
        [
          { p: [-0.12, 0.08, 0.04], a: 0.045 },
          { p: [-0.2, 0.28, 0], a: 0.028 },
          { p: [-0.18, 0.48, -0.04], a: 0.008 },
        ],
        '#d8c48a',
        546,
        { samples: 5, segments: 5 },
      ),
      arm: loft(
        [
          { p: [0.32, 0.55, 0], a: 0.1 },
          { p: [0.48, 0.22, 0.08], a: 0.09 },
          { p: [0.52, -0.02, 0.1], a: 0.11 },
        ],
        '#5a2422',
        547,
      ),
      fist: makeBlobGeometry({ radius: 0.11, detail: 0, scale: [1.1, 0.85, 1], jitter: 0.08, color: '#4a1e1c', seed: 548 }),
      leg: loft(
        [
          { p: [0.14, 0.22, 0], a: 0.1 },
          { p: [0.16, 0.08, 0.02], a: 0.085 },
          { p: [0.14, 0.01, 0.02], a: 0.1 },
        ],
        '#3a1a18',
        549,
        { samples: 5, segments: 6 },
      ),
    },
  };
}

function Flip({ children }) {
  return <group scale={[-1, 1, 1]}>{children}</group>;
}

export function MonsterMesh({ kind, geo }) {
  if (kind === 'pebble') {
    return (
      <group>
        <FacetMesh geometry={geo.shell} position={[0, 0.26, 0]} roughness={1} />
        <FacetMesh geometry={geo.plate} position={[0, 0.4, -0.02]} roughness={1} />
        <FacetMesh geometry={geo.claw} position={[0.34, 0.16, 0.22]} rotation={[0, -0.35, 0.15]} roughness={1} />
        <FacetMesh geometry={geo.claw} position={[-0.34, 0.16, 0.22]} rotation={[0, 0.35, -0.15]} roughness={1} />
        <FacetMesh geometry={geo.pincer} position={[0.42, 0.18, 0.34]} roughness={0.7} />
        <FacetMesh geometry={geo.pincer} position={[-0.42, 0.18, 0.34]} roughness={0.7} />
        <FacetMesh geometry={geo.eye} position={[0.1, 0.34, 0.32]} roughness={0.35} />
        <FacetMesh geometry={geo.eye} position={[-0.1, 0.34, 0.32]} roughness={0.35} />
        <FacetMesh geometry={geo.leg} position={[0.12, 0, 0.12]} rotation={[0, 0.4, 0]} roughness={1} />
        <FacetMesh geometry={geo.leg} position={[0.16, 0, 0]} rotation={[0, 0, 0]} roughness={1} />
        <FacetMesh geometry={geo.leg} position={[0.12, 0, -0.12]} rotation={[0, -0.45, 0]} roughness={1} />
        <Flip>
          <FacetMesh geometry={geo.leg} position={[0.12, 0, 0.12]} rotation={[0, 0.4, 0]} roughness={1} />
          <FacetMesh geometry={geo.leg} position={[0.16, 0, 0]} roughness={1} />
          <FacetMesh geometry={geo.leg} position={[0.12, 0, -0.12]} rotation={[0, -0.45, 0]} roughness={1} />
        </Flip>
      </group>
    );
  }
  if (kind === 'fox') {
    return (
      <group>
        <FacetMesh geometry={geo.body} position={[0, 0.36, 0]} roughness={0.75} />
        <FacetMesh geometry={geo.chest} position={[0, 0.32, 0.22]} roughness={0.8} />
        <FacetMesh geometry={geo.head} position={[0, 0.52, 0.32]} roughness={0.72} />
        <FacetMesh geometry={geo.muzzle} position={[0, 0.46, 0.48]} roughness={0.7} />
        <FacetMesh geometry={geo.nose} position={[0, 0.48, 0.58]} roughness={0.4} />
        <FacetMesh geometry={geo.ear} position={[-0.1, 0.7, 0.28]} roughness={0.75} />
        <FacetMesh geometry={geo.ear} position={[0.1, 0.7, 0.28]} roughness={0.75} />
        <FacetMesh geometry={geo.inner} position={[-0.1, 0.68, 0.3]} roughness={0.85} />
        <FacetMesh geometry={geo.inner} position={[0.1, 0.68, 0.3]} roughness={0.85} />
        <FacetMesh geometry={geo.tail} roughness={0.8} />
        <FacetMesh geometry={geo.leg} position={[0.12, 0, 0.18]} roughness={0.8} />
        <FacetMesh geometry={geo.leg} position={[-0.12, 0, 0.18]} roughness={0.8} />
        <FacetMesh geometry={geo.leg} position={[0.12, 0, -0.16]} roughness={0.8} />
        <FacetMesh geometry={geo.leg} position={[-0.12, 0, -0.16]} roughness={0.8} />
      </group>
    );
  }
  if (kind === 'crow') {
    return (
      <group>
        <FacetMesh geometry={geo.body} position={[0, 0.62, 0]} roughness={0.68} />
        <FacetMesh geometry={geo.head} position={[0, 0.78, 0.22]} roughness={0.65} />
        <FacetMesh geometry={geo.beak} position={[0, 0.74, 0.38]} roughness={0.4} />
        <FacetMesh geometry={geo.eye} position={[0.06, 0.82, 0.28]} roughness={0.3} />
        <FacetMesh geometry={geo.eye} position={[-0.06, 0.82, 0.28]} roughness={0.3} />
        <FacetMesh geometry={geo.wing} position={[0, 0.62, 0]} roughness={0.7} />
        <Flip>
          <FacetMesh geometry={geo.wing} position={[0, 0.62, 0]} roughness={0.7} />
        </Flip>
        <FacetMesh geometry={geo.tail} position={[0, 0.55, 0]} roughness={0.72} />
        <FacetMesh geometry={geo.leg} position={[0.06, 0.42, 0.04]} roughness={0.45} />
        <FacetMesh geometry={geo.leg} position={[-0.06, 0.42, 0.04]} roughness={0.45} />
      </group>
    );
  }
  if (kind === 'golem') {
    return (
      <group>
        <FacetMesh geometry={geo.torso} position={[0, 0.72, 0]} roughness={1} />
        <FacetMesh geometry={geo.belly} position={[0, 0.42, 0.04]} roughness={1} />
        <FacetMesh geometry={geo.head} position={[0, 1.18, 0.04]} roughness={1} />
        <FacetMesh geometry={geo.eye} position={[0.08, 1.2, 0.16]} roughness={0.35} />
        <FacetMesh geometry={geo.eye} position={[-0.08, 1.2, 0.16]} roughness={0.35} />
        <FacetMesh geometry={geo.moss} position={[0.16, 0.95, 0.08]} roughness={1} />
        <FacetMesh geometry={geo.arm} roughness={1} />
        <Flip>
          <FacetMesh geometry={geo.arm} roughness={1} />
        </Flip>
        <FacetMesh geometry={geo.fist} position={[0.68, 0.12, 0.14]} roughness={1} />
        <FacetMesh geometry={geo.fist} position={[-0.68, 0.12, 0.14]} roughness={1} />
        <FacetMesh geometry={geo.leg} roughness={1} />
        <Flip>
          <FacetMesh geometry={geo.leg} roughness={1} />
        </Flip>
      </group>
    );
  }
  return (
    <group>
      <FacetMesh geometry={geo.torso} position={[0, 0.72, 0]} roughness={0.7} />
      <FacetMesh geometry={geo.sash} position={[0, 0.58, 0.02]} roughness={0.85} />
      <FacetMesh geometry={geo.head} position={[0, 1.22, 0.04]} roughness={0.65} />
      <FacetMesh geometry={geo.mask} position={[0, 1.2, 0.2]} roughness={0.5} />
      <FacetMesh geometry={geo.fang} position={[0.05, 1.06, 0.26]} roughness={0.35} />
      <FacetMesh geometry={geo.fang} position={[-0.05, 1.06, 0.26]} roughness={0.35} />
      <group position={[0, 1.22, 0]}>
        <FacetMesh geometry={geo.horn} roughness={0.4} />
        <Flip>
          <FacetMesh geometry={geo.horn} roughness={0.4} />
        </Flip>
      </group>
      <FacetMesh geometry={geo.arm} roughness={0.7} />
      <Flip>
        <FacetMesh geometry={geo.arm} roughness={0.7} />
      </Flip>
      <FacetMesh geometry={geo.fist} position={[0.54, 0, 0.1]} roughness={0.7} />
      <FacetMesh geometry={geo.fist} position={[-0.54, 0, 0.1]} roughness={0.7} />
      <FacetMesh geometry={geo.leg} roughness={0.75} />
      <Flip>
        <FacetMesh geometry={geo.leg} roughness={0.75} />
      </Flip>
    </group>
  );
}
