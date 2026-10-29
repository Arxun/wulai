import GameHud from './GameHud';
import GameLoadingOverlay from './GameLoadingOverlay';

/** 武来 DOM HUD（由 App lazy 引入，落在 game chunk） */
export default function GameModeUi({ mobileActive = false }) {
  return (
    <>
      <GameLoadingOverlay />
      <GameHud mobileActive={mobileActive} />
    </>
  );
}
