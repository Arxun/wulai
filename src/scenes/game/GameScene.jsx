import { memo, useRef } from 'react';
import SkyDome from '../../lib/components/SkyDome';
import { getGamePerf } from './config/perf';
import IdleDeferredLoad from './IdleDeferredLoad';
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
import PerfProbe from './debug/PerfProbe';
import { FxLightPool } from './fx/FxLight';

const PERF_PARAM = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('perf') : null;

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
      {PERF_PARAM && <PerfProbe auto={PERF_PARAM === 'auto'} />}
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
      <FxLightPool />

      <GameTerrain />
      <Scatter />
      <Monsters />
      <WulaiCrater />
      <Player lightRef={lightRef} skidRef={skidRef} lineRef={lineRef} />
      <IdleDeferredLoad />
      <Loot />
      <FloatTexts />
      <SkidMarks ref={skidRef} />
      <BloodStain />
      <SpeedLines ref={lineRef} />
    </>
  );
}

export default memo(GameSceneInner);
