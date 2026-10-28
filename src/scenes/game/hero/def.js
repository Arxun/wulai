import { HERO_NAME } from '../../../config/lore';

/**
 * 主角「小武」：低模在 scenes/lowpoly/person，造型来自 reference 照片 / 低多边形管线。
 */
export const HERO = {
  id: 'xiaowu',
  name: HERO_NAME,
  height: 1.78,
  /** 低模 Person + LOCO_RIG，驾车时隐藏并由 DriverBust 代替 */
  model: 'lowpoly/person',
};
