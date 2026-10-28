import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { N8AOPostPass } from 'n8ao';

/**
 * 环境光遮蔽（N8AO）。
 * 没有直接用 @react-three/postprocessing 自带的 <N8AO>：它内置的 n8ao 副本是旧版，
 * 着色器里还在调用 three 已经删掉的 LinearTosRGB，新版 three 会编译失败。
 * 这里直接用 n8ao 包的 N8AOPostPass，作为一个自定义 Pass 放进 <EffectComposer> 里。
 */
export default function AmbientOcclusion({
  radius = 0.5,
  intensity = 2.2,
  distanceFalloff = 1,
  color = '#2a2f38',
  quality = 'Medium',
  halfRes = false,
}) {
  const { scene, camera, size } = useThree();
  const pass = useMemo(() => new N8AOPostPass(scene, camera, size.width, size.height), [scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    pass.setQualityMode(quality);
    const c = pass.configuration;
    c.aoRadius = radius;
    c.distanceFalloff = distanceFalloff;
    c.intensity = intensity;
    c.color = new THREE.Color(color);
    c.halfRes = halfRes;
    // 后面还有 ToneMapping 做最终的色彩转换，这里不能再做一次 gamma
    c.gammaCorrection = false;
  }, [pass, radius, intensity, distanceFalloff, color, quality, halfRes]);

  useEffect(() => () => pass.dispose?.(), [pass]);
  return <primitive object={pass} />;
}
