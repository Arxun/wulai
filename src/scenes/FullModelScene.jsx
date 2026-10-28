import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Suspense } from 'react';
import PhotoProjectedModel from '../lib/components/PhotoProjectedModel';
import useJson from '../lib/hooks/useJson';
import { FULL_MODEL } from '../config/assets';

/** 模型高度（世界单位）；相机和控制器都按这个高度布置 */
export const MODEL_HEIGHT = 1.8;

/**
 * 完整 360° 模型：GLB（单图转 3D 补全背面）+ 原照片投影回正面。
 * 可以自由旋转 / 缩放 / 平移。
 */
export default function FullModelScene({ autoRotate = false, usePhoto = true, controlsRef }) {
  const { data: meta, error } = useJson(FULL_MODEL.meta);

  if (error) {
    console.error('[FullModelScene] 读取模型 meta 失败：', error);
    return null;
  }
  if (!meta) return null;

  return (
    <>
      <color attach="background" args={['#dfe5e9']} />
      <Suspense fallback={null}>
        <PhotoProjectedModel
          glbUrl={FULL_MODEL.glb}
          photoUrl={meta.photo}
          projMatrix={meta.projMatrix}
          frontDir={meta.frontDir}
          usePhoto={usePhoto}
          height={MODEL_HEIGHT}
        />
      </Suspense>
      {/* 脚下的柔和接触阴影，让人物“站在”地上 */}
      <ContactShadows position={[0, 0.002, 0]} opacity={0.35} scale={5} blur={2.6} far={2.2} resolution={512} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, MODEL_HEIGHT * 0.52, 0]}
        enableDamping
        autoRotate={autoRotate}
        autoRotateSpeed={1.6}
        minDistance={0.8}
        maxDistance={7}
        maxPolarAngle={Math.PI * 0.62}
      />
    </>
  );
}
