import { useMemo } from 'react';
import * as THREE from 'three';
import FacetMesh from '../../lib/components/FacetMesh';
import { makeLogGeometry } from '../../lib/geometry/organic';

/**
 * 一段原木：从 from 画到 to，from 端粗、to 端细。
 * 栏杆、松树枝干都用它拼出来。
 */
export default function Log({
  from,
  to,
  radius = 0.05,
  taper = 0.85,
  seed = 1,
  wobble = 0.015,
  color = '#5e4a39',
}) {
  const key = `${from.join()}|${to.join()}|${radius}|${taper}|${seed}|${wobble}|${color}`;
  const { geom, position, quaternion } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const length = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    return {
      geom: makeLogGeometry({ radius, length, seed, wobble, taper, color }),
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: q,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <FacetMesh geometry={geom} position={position} quaternion={quaternion} roughness={0.95} />
  );
}
