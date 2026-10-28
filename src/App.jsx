import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useRef, useState } from 'react';
import ControlPanel from './lib/components/ControlPanel';
import { urlParam } from './lib/hooks/useUrlParams';
import { REFERENCE_PHOTO } from './config/assets';
import { DEFAULT_MODE, MODES } from './config/modes';
import FullModelScene from './scenes/FullModelScene';
import GameHud from './scenes/game/GameHud';
import GameScene from './scenes/game/GameScene';
import LowPolyScene from './scenes/lowpoly/LowPolyScene';
import PhotoParallaxScene from './scenes/PhotoParallaxScene';
import './App.css';

/** 渲染当前模式的场景（画布配置全部来自 MODES） */
function ModeCanvas({ mode, strength, autoRotate, usePhoto, controlsRef }) {
  const cfg = MODES[mode];
  const isGame = mode === 'game';
  return (
    <Canvas
      key={mode}
      shadows={mode === 'lowpoly' || isGame}
      dpr={isGame ? [1, 2] : [1, 2]}
      camera={cfg.camera}
      gl={{ antialias: true, preserveDrawingBuffer: !isGame }}
    >
      <Suspense fallback={null}>
        {mode === 'full' && <FullModelScene autoRotate={autoRotate} usePhoto={usePhoto} controlsRef={controlsRef} />}
        {mode === 'parallax' && <PhotoParallaxScene strength={strength} auto={autoRotate} />}
        {mode === 'game' && <GameScene />}
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
  const [mode, setMode] = useState(MODES[urlParam.string('mode')] ? urlParam.string('mode') : DEFAULT_MODE);
  const [showRef, setShowRef] = useState(urlParam.bool('ref', true));
  const [autoRotate, setAutoRotate] = useState(urlParam.bool('auto', mode !== 'full'));
  const [overlay, setOverlay] = useState(urlParam.number('overlay', 0));
  const [strength, setStrength] = useState(urlParam.number('strength', 1));
  const [usePhoto, setUsePhoto] = useState(urlParam.bool('photo', true));

  const cfg = MODES[mode];
  const isGame = mode === 'game';
  const orbitMode = mode === 'full' || mode === 'lowpoly';

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
    { type: 'slider', label: '叠加参考图', min: 0, max: 1, step: 0.05, value: overlay, onChange: setOverlay, hidden: isGame },
    {
      type: 'slider',
      label: '立体强度',
      min: 0,
      max: 2,
      step: 0.05,
      value: strength,
      onChange: setStrength,
      hidden: mode !== 'parallax',
    },
    {
      type: 'button',
      label: usePhoto ? '照片投影：开' : '照片投影：关',
      onClick: () => setUsePhoto((v) => !v),
      hidden: mode !== 'full',
    },
    { type: 'button', label: showRef ? '隐藏对照图' : '显示对照图', onClick: () => setShowRef((v) => !v), hidden: isGame },
    {
      type: 'button',
      label: autoRotate ? (orbitMode ? '停止旋转' : '停止摇镜') : orbitMode ? '自动旋转' : '自动摇镜',
      onClick: () => setAutoRotate((v) => !v),
      hidden: isGame,
    },
    {
      type: 'button',
      label: '重置视角',
      onClick: () => controlsRef.current?.reset(),
      hidden: !orbitMode,
    },
  ];

  return (
    <div className={`page${urlParam.string('ui') === '0' ? ' noui' : ''}`}>
      {showRef && !isGame && (
        <div className="frame ref">
          <img src={REFERENCE_PHOTO.url} alt="参考照片" />
          <span className="tag">参考照片</span>
        </div>
      )}

      <div className={`frame${isGame ? ' wide' : ''}`}>
        <ModeCanvas
          mode={mode}
          strength={strength}
          autoRotate={autoRotate}
          usePhoto={usePhoto}
          controlsRef={controlsRef}
        />

        {!isGame && (
          <img
            className="overlay"
            src={REFERENCE_PHOTO.url}
            alt=""
            style={{ opacity: overlay }}
            draggable={false}
          />
        )}
        <span className="tag">{cfg.tag}</span>

        {isGame && <GameHud />}

        <ControlPanel items={panelItems} />
        <div className="hint">{cfg.hint}</div>
      </div>
    </div>
  );
}
