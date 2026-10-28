import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import ControlPanel from './lib/components/ControlPanel';
import { urlParam } from './lib/hooks/useUrlParams';
import { REFERENCE_PHOTO } from './config/assets';
import { GAME_TITLE } from './config/lore';
import { DEFAULT_MODE, MODES } from './config/modes';
import GameHud from './scenes/game/GameHud';
import GameLoadReporter from './scenes/game/GameLoadReporter';
import GameLoadingOverlay from './scenes/game/GameLoadingOverlay';
import GameScene from './scenes/game';
import { beginGameLoad, resetGameLoad } from './scenes/game/stores/gameLoadingStore';
import LowPolyScene from './scenes/lowpoly/LowPolyScene';
// Legacy（入口已隐藏）：360° 模型、照片视差 → src/scenes/_legacy/
// import FullModelScene from './scenes/_legacy/FullModelScene';
// import PhotoParallaxScene from './scenes/_legacy/PhotoParallaxScene';
import { GAME_PERF } from './scenes/game/config/perf';
import { useGameMobile } from './lib/hooks/useGameMobile';
import MobileGameFrame from './scenes/game/mobile/MobileGameFrame';
import MobileForceLandscape from './scenes/game/mobile/MobileForceLandscape';
import './App.css';

/** 渲染当前模式的场景（画布配置来自 MODES） */
function ModeCanvas({ mode, autoRotate, controlsRef }) {
  const cfg = MODES[mode];
  const isGame = mode === 'game';
  return (
    <Canvas
      key={mode}
      shadows={mode === 'lowpoly' || isGame}
      dpr={isGame ? GAME_PERF.dpr : [1, 2]}
      camera={cfg.camera}
      gl={{ antialias: true, preserveDrawingBuffer: !isGame }}
    >
      {isGame && <GameLoadReporter />}
      <Suspense fallback={null}>
        {mode === 'game' && <GameScene />}
        {/* Legacy
        {mode === 'full' && <FullModelScene autoRotate={autoRotate} usePhoto={usePhoto} controlsRef={controlsRef} />}
        {mode === 'parallax' && <PhotoParallaxScene strength={strength} auto={autoRotate} />}
        */}
      </Suspense>
      {mode === 'lowpoly' && (
        <>
          <LowPolyScene />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={cfg.target}
            enableDamping
            autoRotate={autoRotate}
            autoRotateSpeed={1.2}
            minDistance={0.8}
            maxDistance={10}
            maxPolarAngle={Math.PI / 2 + 0.15}
          />
        </>
      )}
    </Canvas>
  );
}

export default function App() {
  const controlsRef = useRef();
  const initialMode = MODES[urlParam.string('mode')] ? urlParam.string('mode') : DEFAULT_MODE;
  const [mode, setMode] = useState(initialMode);
  const [showRef, setShowRef] = useState(urlParam.bool('ref', true));
  const [autoRotate, setAutoRotate] = useState(urlParam.bool('auto', mode === 'lowpoly'));
  const [overlay, setOverlay] = useState(urlParam.number('overlay', 0));

  const cfg = MODES[mode];
  const isGame = mode === 'game';
  const isLowPoly = mode === 'lowpoly';
  const gameMobile = useGameMobile();
  const mobileGame = isGame && gameMobile.active;

  useEffect(() => {
    document.title = GAME_TITLE;
  }, []);

  useEffect(() => {
    if (isGame) beginGameLoad();
    else resetGameLoad();
  }, [isGame]);

  const panelItems = [
    {
      type: 'group',
      items: Object.entries(MODES).map(([key, m]) => ({
        type: 'button',
        label: m.label,
        active: key === mode,
        onClick: () => setMode(key),
      })),
    },
    {
      type: 'slider',
      label: '叠加参考图',
      min: 0,
      max: 1,
      step: 0.05,
      value: overlay,
      onChange: setOverlay,
      hidden: !isLowPoly,
    },
    {
      type: 'button',
      label: showRef ? '隐藏对照图' : '显示对照图',
      onClick: () => setShowRef((v) => !v),
      hidden: !isLowPoly,
    },
    {
      type: 'button',
      label: autoRotate ? '停止旋转' : '自动旋转',
      onClick: () => setAutoRotate((v) => !v),
      hidden: !isLowPoly,
    },
    {
      type: 'button',
      label: '重置视角',
      onClick: () => controlsRef.current?.reset(),
      hidden: !isLowPoly,
    },
  ];

  return (
    <div
      className={`page${urlParam.string('ui') === '0' ? ' noui' : ''}${mobileGame ? ' mobile-game' : ''}${
        mobileGame && !gameMobile.landscape ? ' mobile-portrait' : ''
      }`}
    >
      {showRef && isLowPoly && (
        <div className="frame ref">
          <img src={REFERENCE_PHOTO.url} alt="参考照片" />
          <span className="tag">参考照片</span>
        </div>
      )}

      <div className={`frame${isGame ? ' wide' : ''}${mobileGame ? ' mobile-frame' : ''}`}>
        {mobileGame ? (
          <MobileForceLandscape rotate={!gameMobile.landscape}>
            <MobileGameFrame enabled>
              <ModeCanvas mode={mode} autoRotate={autoRotate} controlsRef={controlsRef} />
              {isGame && <GameLoadingOverlay />}
              {isGame && <GameHud mobileActive />}
            </MobileGameFrame>
          </MobileForceLandscape>
        ) : (
          <>
            <ModeCanvas mode={mode} autoRotate={autoRotate} controlsRef={controlsRef} />
            {isGame && <GameLoadingOverlay />}
            {isGame && <GameHud />}
          </>
        )}

        {isLowPoly && (
          <img
            className="overlay"
            src={REFERENCE_PHOTO.url}
            alt=""
            style={{ opacity: overlay }}
            draggable={false}
          />
        )}
        {!isGame && <span className="tag">{cfg.tag}</span>}

        <ControlPanel items={panelItems} />
        <div className="hint">{cfg.hint}</div>
      </div>
    </div>
  );
}
