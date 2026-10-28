import { Environment, Lightformer } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import SkyDome from '../../lib/components/SkyDome';
import FloatTexts from './FloatTexts';
import GameTerrain from './GameTerrain';
import Loot from './Loot';
import Monsters from './Monsters';
import Player from './Player';
import Scatter from './Scatter';
import SkidMarks from './SkidMarks';
import SpeedLines from './SpeedLines';
import Su7CarPlacement from './Su7CarPlacement';
import WulaiCrater from './WulaiCrater';

/**
 * 《武来》游戏模式：黄山步道地图 + 第三人称操控主角「小武」。
 */

const HAZE = '#c8d6e0';

export default function GameScene() {
  const lightRef = useRef();
  const skidRef = useRef();
  const lineRef = useRef();

  return (
    <>
      <SkyDome top="#7ba4cc" horizon="#d4e0e8" bottom="#c2ccd4" radius={900} />
      <fog attach="fog" args={[HAZE, 80, 560]} />

      <hemisphereLight args={['#e8f1f7', '#6b6552', 0.85]} />
      <directionalLight
        ref={lightRef}
        intensity={2.3}
        color="#fff4e4"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[40, 20, -30]} intensity={0.35} color="#dce8f2" />

      <Suspense fallback={null}>
        <Environment resolution={64} frames={1} environmentIntensity={0.5}>
          <Lightformer form="rect" intensity={2} color="#f2f7fb" position={[0, 10, 4]} rotation-x={Math.PI / 2} scale={[20, 12, 1]} />
          <Lightformer form="rect" intensity={0.7} color="#9a8c76" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} />
        </Environment>
      </Suspense>

      <GameTerrain />
      <Scatter />
      <Monsters />
      <WulaiCrater />
      <Suspense fallback={null}>
        <Su7CarPlacement />
      </Suspense>
      <Player lightRef={lightRef} skidRef={skidRef} lineRef={lineRef} />
      <Loot />
      <FloatTexts />
      <SkidMarks ref={skidRef} />
      <SpeedLines ref={lineRef} />
    </>
  );
}
