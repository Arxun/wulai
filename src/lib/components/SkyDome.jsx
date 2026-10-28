import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { createSkyGradientMaterial } from '../shaders/skyGradient';

/** 渐变天空球，始终跟随相机，永远不会走到边缘 */
export default function SkyDome({ radius = 300, ...colors }) {
  const mesh = useRef();
  const material = useMemo(() => createSkyGradientMaterial(colors), [colors.top, colors.horizon, colors.bottom]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }) => mesh.current?.position.copy(camera.position));
  return (
    <mesh ref={mesh} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[radius, 24, 16]} />
    </mesh>
  );
}
