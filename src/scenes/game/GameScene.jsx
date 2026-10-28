import { Suspense, memo, useRef } from 'react';
import SkyDome from '../../lib/components/SkyDome';
import { getGamePerf } from './config/perf';
import GameEnvironment from './GameEnvironment';
import FloatTexts from './FloatTexts';
import Loot from './Loot';
import BloodStain from './fx/BloodStain';
import SkidMarks from './SkidMarks';
import SpeedLines from './SpeedLines';
import { Player } from './hero';
import { GameTerrain, Scatter, MAP_ENV } from './maps/huangshan';
import { WulaiCrater } from './skills/fx';
import { Monsters } from './monsters';
import GameDiagnostics from './GameDiagnostics';
import SkillFxWarmup from './SkillFxWarmup';
import { Su7CarPlacement } from './vehicles';

function GameSceneInner() {
  const lightRef = useRef();
  const skidRef = useRef();
  const lineRef = useRef();
  const { sky, fog } = MAP_ENV;
  const sm = getGamePerf().shadowMapSize;

  return (
    <>
      <GameDiagnostics />
      <SkillFxWarmup />
      <SkyDome top={sky.top} horizon={sky.horizon} bottom={sky.bottom} radius={sky.radius} />
      <fog attach="fog" args={fog} />

      <hemisphereLight args={['#e8f1f7', '#6b6552', 0.85]} />
      <directionalLight
        ref={lightRef}
        intensity={2.3}
        color="#fff4e4"
        castShadow
        shadow-mapSize={[sm, sm]}
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
        <GameEnvironment />
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
      <BloodStain />
      <SpeedLines ref={lineRef} />
    </>
  );
}

export default memo(GameSceneInner);
