import * as huangshan from './huangshan';

/**
 * 地图注册表。新地图：新建 maps/<id>/，在此登记，GameScene 读 activeMap()。
 */
export const MAPS = {
  huangshan: {
    id: 'huangshan',
    label: huangshan.MAP_ENV.label,
    ...huangshan.MAP_ENV,
    module: huangshan,
  },
};

export const DEFAULT_MAP_ID = 'huangshan';

let _activeId = DEFAULT_MAP_ID;

export function getMapId() {
  return _activeId;
}

export function setMapId(id) {
  if (!MAPS[id]) throw new Error(`未知地图: ${id}`);
  _activeId = id;
}

/** @returns {typeof huangshan} */
export function activeMap() {
  return MAPS[_activeId].module;
}
