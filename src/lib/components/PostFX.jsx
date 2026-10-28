import { EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import AmbientOcclusion from './AmbientOcclusion';

/**
 * 通用后处理：环境光遮蔽（见 AmbientOcclusion，让缝隙 / 接触处更有体积）+ 抗锯齿 + 色调映射 + 轻微暗角。
 * 放在 <Canvas> 里即可，不关心场景内容。注意：启用后 EffectComposer 会接管色调映射，
 * 所以这里显式带一个 ToneMapping。
 */
export default function PostFX({
  ao = true,
  aoRadius = 0.5,
  aoIntensity = 2.2,
  vignette = 0.32,
  toneMapping = ToneMappingMode.ACES_FILMIC,
}) {
  return (
    <EffectComposer multisampling={0} disableNormalPass>
      {ao && <AmbientOcclusion radius={aoRadius} intensity={aoIntensity} />}
      <SMAA />
      <ToneMapping mode={toneMapping} />
      <Vignette offset={0.35} darkness={vignette} />
    </EffectComposer>
  );
}
