import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ControlPanel from './lib/components/ControlPanel';
import { urlParam } from './lib/hooks/useUrlParams';
import { REFERENCE_PHOTO } from './config/assets';
import { GAME_TITLE } from './config/lore';
import { DEFAULT_MODE, MODES } from './config/modes';
import { beginGameLoad, resetGameLoad } from './scenes/game/stores/gameLoadingStore';
import { setGamePerfMobile } from './scenes/game/config/perf';
import { applyGpuAccelDomClass, buildCanvasGlOptions } from './scenes/game/lib/gpuAccel';
import { useGameMobile } from './lib/hooks/useGameMobile';
import { useMobileInputGuard } from './lib/hooks/useMobileInputGuard';
import { computeMobileViewLayout, isPortraitViewport, mobileCanvasKey } from './scenes/game/mobile/mobileViewLayout';
import './App.css';

const GameCanvasInner = lazy(() => import('./scenes/game/GameCanvasInner'));
const GameModeUi = lazy(() => import('./scenes/game/GameModeUi'));
const LowPolyScene = lazy(() => import('./scenes/lowpoly/LowPolyScene'));
const MobileGameFrame = lazy(() => import('./scenes/game/mobile/MobileGameFrame'));
const MobileRotateFab = lazy(() => import('./scenes/game/mobile/MobileRotateFab'));
const MobileViewRotator = lazy(() => import('./scenes/game/mobile/MobileViewRotator'));

/** 渲染当前模式的场景（画布配置来自 MODES） */
function ModeCanvas({ mode, autoRotate, controlsRef, canvasKey = 'normal', mobileLayoutSync = false }) {
  const cfg = MODES[mode];
  const isGame = mode === 'game';
  const [perf, setPerf] = useState(null);

  useLayoutEffect(() => {
    if (!isGame) {
      setPerf(null);
      return;
    }
    import('./scenes/game/config/perf').then((m) => setPerf(m.getGamePerf()));
  }, [isGame, mobileLayoutSync]);

  const glOptions = useMemo(
    () =>
      buildCanvasGlOptions({
        antialias: isGame ? !mobileLayoutSync : true,
        preserveDrawingBuffer: !isGame,
      }),
    [isGame, mobileLayoutSync],
  );

  return (
    <Canvas
      key={isGame ? `${mode}-${canvasKey}` : mode}
      shadows={mode === 'lowpoly' || isGame}
      dpr={isGame && perf ? perf.dpr : isGame ? [1, 1.5] : [1, 2]}
      camera={cfg.camera}
      gl={glOptions}
      resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      {isGame && (
        <Suspense fallback={null}>
          <GameCanvasInner mobileLayoutSync={mobileLayoutSync} />
        </Suspense>
      )}
      {mode === 'lowpoly' && (
        <Suspense fallback={null}>
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
        </Suspense>
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
  const gameMobile = useGameMobile();
  const [viewRotation, setViewRotation] = useState(() =>
    initialMode === 'game' && gameMobile.active && isPortraitViewport() ? 90 : 0,
  );
  const [viewportTick, setViewportTick] = useState(0);

  const cfg = MODES[mode];
  const isGame = mode === 'game';
  const isLowPoly = mode === 'lowpoly';
  const mobileGame = isGame && gameMobile.active;
  const portrait = mobileGame && isPortraitViewport();
  const mobileViewLayout = mobileGame ? computeMobileViewLayout(viewRotation) : null;
  const canvasKey = mobileCanvasKey(viewRotation, mobileGame);
  useMobileInputGuard(mobileGame);

  useLayoutEffect(() => {
    setGamePerfMobile(mobileGame);
  }, [mobileGame]);

  // 只在横竖屏切换时自动摆正：竖屏转 90°，转回横屏归零；其间手动旋转不受影响
  useLayoutEffect(() => {
    if (!mobileGame) return;
    setViewRotation(portrait ? 90 : 0);
  }, [mobileGame, portrait]);

  useEffect(() => {
    if (!mobileGame) return;
    const bump = () => setViewportTick((n) => n + 1);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', bump);
    window.addEventListener('resize', bump);
    return () => {
      vv?.removeEventListener('resize', bump);
      window.removeEventListener('resize', bump);
    };
  }, [mobileGame]);
  void viewportTick;

  useEffect(() => {
    document.title = GAME_TITLE;
  }, []);

  useEffect(() => {
    if (isGame) {
      applyGpuAccelDomClass();
      beginGameLoad();
      void import('./scenes/game/GameCanvasInner');
      void import('./scenes/game/GameModeUi');
      // 一局只在离开游戏模式时结束；旋转 / 布局切换导致的 Canvas remount 不算
      return () => {
        void import('./scenes/game/stores/gameSession').then((m) => m.resetGameSession());
      };
    }
    document.documentElement.classList.remove('gpu-accel', 'gpu-software');
    resetGameLoad();
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

  const gameUi = isGame && (
    <Suspense fallback={null}>
      <GameModeUi mobileActive={mobileGame} />
    </Suspense>
  );

  const body = (
    <>
      {showRef && isLowPoly && (
        <div className="frame ref">
          <img src={REFERENCE_PHOTO.url} alt="参考照片" />
          <span className="tag">参考照片</span>
        </div>
      )}

      <div className={`frame${isGame ? ' wide' : ''}${mobileGame ? ' mobile-frame' : ''}`}>
        {mobileGame ? (
          <Suspense fallback={null}>
            <MobileGameFrame enabled>
              <ModeCanvas
                mode={mode}
                autoRotate={autoRotate}
                controlsRef={controlsRef}
                canvasKey={canvasKey}
                mobileLayoutSync
              />
              {gameUi}
            </MobileGameFrame>
          </Suspense>
        ) : (
          <>
            <ModeCanvas mode={mode} autoRotate={autoRotate} controlsRef={controlsRef} />
            {gameUi}
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

        <ControlPanel items={panelItems} keyboardFocus={!isGame} />
        <div className="hint">{cfg.hint}</div>
      </div>
    </>
  );

  return (
    <div className={`page${urlParam.string('ui') === '0' ? ' noui' : ''}${mobileGame ? ' mobile-game' : ''}`}>
      {mobileGame ? (
        <Suspense fallback={body}>
          <>
            <MobileRotateFab onRotate={() => setViewRotation((d) => (d + 90) % 360)} />
            <MobileViewRotator enabled layout={mobileViewLayout}>
              {body}
            </MobileViewRotator>
          </>
        </Suspense>
      ) : (
        body
      )}
    </div>
  );
}
