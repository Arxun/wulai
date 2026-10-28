import { MAPS, getMapId } from './maps/registry';

/** 左上角：当前地图名称 */
export default function MapHudHeader() {
  const map = MAPS[getMapId()];
  const label = map?.label ?? '未知地图';

  return (
    <p className="hud-map" aria-label={`地图：${label}`}>
      {label}
    </p>
  );
}
