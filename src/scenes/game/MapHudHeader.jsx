import { useEffect, useRef } from 'react';
import { MAPS, activeMap, getMapId } from './maps/registry';
import { world } from './stores/combatStore';

/**
 * 左上角：指北针 + 当前地图名称 + 坐标。
 *
 * 约定世界 -Z 为北、+X 为东。显示坐标以地图西南角为 (0, 0)：
 * X = x + HALF、Y = HALF - z，全图都是正数，往东 X 变大、往北 Y 变大。只换算显示，世界坐标不动。
 * 指北针和坐标每帧都变，直接写 DOM，不触发 React 重渲染。
 */
export default function MapHudHeader() {
  const map = MAPS[getMapId()];
  const label = map?.label ?? '未知地图';
  const half = activeMap().HALF;
  const roseRef = useRef(null);
  const coordRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    let lastDeg = NaN;
    let lastCoord = '';
    const tick = () => {
      // 镜头朝向从北顺时针为 -camYaw，罗盘反向转回去让 N 始终指向真北
      const deg = Math.round(((world.camYaw * 180) / Math.PI) * 2) / 2;
      if (deg !== lastDeg && roseRef.current) {
        roseRef.current.style.transform = `rotate(${deg}deg)`;
        lastDeg = deg;
      }
      const coord = `X ${Math.round(world.x + half)}  Y ${Math.round(half - world.z)}`;
      if (coord !== lastCoord && coordRef.current) {
        coordRef.current.textContent = coord;
        lastCoord = coord;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [half]);

  return (
    <div className="hud-map" aria-label={`地图：${label}`}>
      <span className="hud-compass" aria-hidden>
        <svg ref={roseRef} className="hud-compass__rose" viewBox="0 0 30 30">
          <text x="15" y="9" textAnchor="middle" className="hud-compass__n">
            N
          </text>
          <polygon points="15,10 18,16 12,16" fill="#ff5a4a" />
          <polygon points="12,16 18,16 15,24" fill="rgba(230,236,242,0.85)" />
        </svg>
      </span>
      <span className="hud-map__name">{label}</span>
      <span ref={coordRef} className="hud-map__coord" />
    </div>
  );
}
