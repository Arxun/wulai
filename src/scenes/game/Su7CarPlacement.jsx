import { useMemo } from 'react';
import { terrainHeight } from './heightfield';
import Su7Car from './Su7Car';
import { SU7_SPAWN } from './worldObstacles';

/** 山路旁停靠的 SU7：Y 贴地形，略下沉避免轮子悬空 */
export default function Su7CarPlacement(props) {
  const {
    x = SU7_SPAWN.x,
    z = SU7_SPAWN.z,
    sink = SU7_SPAWN.sink,
    rotationY = SU7_SPAWN.rotationY,
    scale = SU7_SPAWN.scale,
    ...rest
  } = props;
  const y = useMemo(() => terrainHeight(x, z) - sink, [x, z, sink]);
  return <Su7Car x={x} y={y} z={z} rotationY={rotationY} scale={scale} {...rest} />;
}
