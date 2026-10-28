import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useRef, useState } from 'react';
import ControlPanel from './lib/components/ControlPanel';
import { urlParam } from './lib/hooks/useUrlParams';
import { REFERENCE_PHOTO } from './config/assets';
import { DEFAULT_MODE, MODES } from './config/modes';
import GameHud from './scenes/game/GameHud';
import GameScene from './scenes/game';
import LowPolyScene from './scenes/lowpoly/LowPolyScene';
// Legacy（入口已隐藏）：360° 模型、照片视差 → src/scenes/_legacy/
// import FullModelScene from './scenes/_legacy/FullModelScene';
// import PhotoParallaxScene from './scenes/_legacy/PhotoParallaxScene';
import './App.css';

/** 渲染当前模式的场景（画布配置来自 MODES） */
function ModeCanvas({ mode, autoRotate, controlsRef }) {
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
    <div className={`page${urlParam.string('ui') === '0' ? ' noui' : ''}`}>
      {showRef && isLowPoly && (
        <div className="frame ref">
          <img src={REFERENCE_PHOTO.url} alt="参考照片" />
          <span className="tag">参考照片</span>
        </div>
      )}

      <div className={`frame${isGame ? ' wide' : ''}`}>
        <ModeCanvas mode={mode} autoRotate={autoRotate} controlsRef={controlsRef} />

        {isLowPoly && (
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
