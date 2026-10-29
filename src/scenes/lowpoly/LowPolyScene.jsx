import { Environment, Lightformer } from '@react-three/drei';
import PostFX from '../../lib/components/PostFX';
import SkyDome from '../../lib/components/SkyDome';
import { urlParam } from '../../lib/hooks/useUrlParams';
import Person from './person/index';
import { FxLightPool } from '../game/fx/FxLight';
import Pines from './Pines';
import Railing from './Railing';
import Terrain from './Terrain';

/** 雾 / 地平线的颜色：天空、远山、雾要用同一个色，层次才会融在一起 */
const HAZE = '#d6dfe6';

/**
 * 场景：阴天薄雾 + 柔和主光，呼应照片里灰白的天空与蓝灰的远山。
 *  - 天光（半球光）+ 一盏带软阴影的主光 + 右侧补光
 *  - 程序化环境（Lightformer 摆几块柔光板，不依赖任何 HDR 文件），给墨镜 / 靴子等高光材质提供反射
 *  - 后处理：环境光遮蔽 + 抗锯齿 + 色调映射 + 暗角（?post=0 可关闭）
 */
export default function LowPolyScene() {
  const post = urlParam.bool('post', true);
  return (
    <>
      <SkyDome top="#cdd9e3" horizon="#e6ebef" bottom="#cfd8de" />
      <fog attach="fog" args={[HAZE, 12, 180]} />

      <hemisphereLight args={['#eaf0f4', '#8d7d6c', 0.9]} />
      <directionalLight
        position={[-3.5, 6.5, 5]}
        intensity={2.1}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={4}
        shadow-camera-bottom={-2}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-radius={6}
      />
      <directionalLight position={[4, 2.5, 3]} intensity={0.4} color="#dfe8f0" />
      <FxLightPool />

      {/* 程序化环境光：顶部大柔光箱 + 两侧灯条 + 地面暖色反光 */}
      <Environment resolution={128} frames={1} environmentIntensity={0.55}>
        <Lightformer form="rect" intensity={2.2} color="#f4f8fb" position={[0, 6, 2]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#e3ecf4" position={[-6, 2, 3]} rotation-y={Math.PI / 2} scale={[4, 5, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#dbe6ef" position={[6, 2, 2]} rotation-y={-Math.PI / 2} scale={[4, 5, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#a89684" position={[0, -3, 2]} rotation-x={-Math.PI / 2} scale={[10, 6, 1]} />
      </Environment>

      <Terrain />
      <Railing />
      <Pines />
      <Person />
      {post && <PostFX />}
    </>
  );
}
