/** Legacy：入口已在 App / modes 中注释，恢复照片视差模式时使用 */
import DepthPhotoLayer from '../../lib/components/DepthPhotoLayer';
import useParallaxCamera from '../../lib/hooks/useParallaxCamera';
import { PHOTO_PARALLAX as P } from '../../config/assets';

/**
 * 2.5D 照片视差：整张照片 + 深度置换（前景层）+ 人物被抠掉并补全的背景层。
 * 只能小幅度转视角（看不到背面）；完整 360° 见 FullModelScene。
 */
export default function PhotoParallaxScene({ strength = 1, auto = true }) {
  const range = 0.8 * strength;

  useParallaxCamera({ distance: P.camDistance, auto });

  return (
    <>
      <color attach="background" args={['#cfd6da']} />
      <DepthPhotoLayer
        colorUrl={P.bgColor}
        depthUrl={P.bgDepth}
        aspect={P.aspect}
        camDistance={P.camDistance}
        range={range}
        offset={0.03}
        margin={0.35}
        cut={false}
        segX={200}
        renderOrder={0}
      />
      <DepthPhotoLayer
        colorUrl={P.color}
        depthUrl={P.depth}
        aspect={P.aspect}
        camDistance={P.camDistance}
        range={range}
        segX={432}
        renderOrder={1}
      />
    </>
  );
}
