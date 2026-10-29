import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FxLight } from './fx/FxLight';
import { vehicle } from './vehicles/runtime';

/** 氮气喷火：步行挂在玩家身后；开车挂在 SU7 车尾（+Z 前进，火往 -Z） */

const PRESETS = {
  onFoot: {
    jets: [-0.22, 0.22],
    anchor: [0, 0.92, -0.32],
    jetY: 0.92,
    scale: 1,
    light: [0, 0.9, -1.6],
    lightMul: 18,
    jetRotX: -Math.PI / 2 + 0.1,
    sparkBack: -1,
  },
  car: {
    jets: [-0.52, 0.52],
    anchor: [0, 0.38, -2.12],
    jetY: 0.38,
    scale: 1.85,
    light: [0, 0.44, -2.65],
    lightMul: 26,
  },
};

const SPARKS = 16;

function cone(radius, height, color, opacity) {
  return {
    geom: new THREE.ConeGeometry(radius, height, 7, 1, true),
    mat: new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };
}

export default function NitroFlame({ stateRef, variant = 'onFoot' }) {
  const preset = PRESETS[variant] ?? PRESETS.onFoot;
  const root = useRef();
  const light = useRef();
  const layers = useRef([]);
  const sparks = useRef();

  const parts = useMemo(
    () => [
      cone(0.48, 3.6, '#ff3d0a', 0.32),
      cone(0.36, 2.6, '#ff5a18', 0.48),
      cone(0.24, 1.7, '#ff9a30', 0.62),
      cone(0.12, 0.95, '#fff4d2', 0.95),
    ],
    [],
  );

  const sparkGeom = useMemo(() => new THREE.TetrahedronGeometry(0.055), []);
  const sparkMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffcf6a',
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const sparkSeeds = useMemo(() => Array.from({ length: SPARKS }, () => Math.random()), []);

  useFrame((state, dt) => {
    const drift = stateRef?.current ?? stateRef;
    const boost = drift?.boost ?? 0;
    const inCar = vehicle.inCar;
    const on =
      boost > 0 &&
      ((variant === 'onFoot' && !inCar) || (variant === 'car' && inCar));
    if (root.current) root.current.visible = on;
    if (!on) return;

    const t = state.clock.elapsedTime;
    const env = THREE.MathUtils.clamp(boost / 0.18, 0, 1);
    const s = preset.scale;

    layers.current.forEach((m, i) => {
      if (!m) return;
      const flicker = 0.78 + 0.22 * Math.sin(t * (34 + i * 11) + i);
      const puff = 0.9 + 0.1 * Math.sin(t * 9 + i * 2);
      m.scale.set(
        s * puff * (0.85 + 0.15 * flicker),
        s * flicker * env,
        s * puff * (0.85 + 0.15 * flicker),
      );
    });

    if (sparks.current) {
      sparks.current.children.forEach((sp, i) => {
        const seed = sparkSeeds[i];
        const life = (t * (1.6 + seed) + seed * 3) % 1;
        const back = preset.sparkBack ?? -1;
        sp.position.z = back * (0.9 + life * 5.6);
        sp.position.x = (seed - 0.5) * 0.95 * life * 2.6;
        sp.position.y = preset.jetY + Math.sin(seed * 20) * 0.12 - life * 0.28;
        const k = (1 - life) * env;
        sp.scale.setScalar(s * k * (0.6 + seed));
        sp.rotation.x += dt * 9;
        sp.rotation.y += dt * 7;
      });
    }

    if (light.current) light.current.intensity = (preset.lightMul + Math.sin(t * 28) * 6) * env;
  });

  const [ax, ay, az] = preset.anchor;
  const [lx, ly, lz] = preset.light;

  return (
    <group ref={root} visible={false} position={[ax, ay, az]}>
      {preset.jets.map((x, j) => (
        <group
          key={j}
          position={[x, preset.jetY - ay, -0.32]}
          rotation={[preset.jetRotX ?? -Math.PI / 2 + 0.1, 0, 0]}
        >
          {parts.map((p, i) => (
            <mesh
              key={i}
              ref={(el) => {
                layers.current[j * parts.length + i] = el;
              }}
              geometry={p.geom}
              material={p.mat}
              position={[0, p.geom.parameters.height * 0.5, 0]}
            />
          ))}
        </group>
      ))}

      <group ref={sparks}>
        {sparkSeeds.map((_, i) => (
          <mesh key={i} geometry={sparkGeom} material={sparkMat} />
        ))}
      </group>

      <FxLight
        ref={light}
        position={[lx - ax, ly - ay, lz - az]}
        color="#ff8a3c"
        intensity={0}
        distance={14}
        decay={2}
      />
    </group>
  );
}
