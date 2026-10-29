import { Suspense } from 'react';
import Su7CarPlacement from './Su7CarPlacement';
import Su7LoadingPlaceholder from './Su7LoadingPlaceholder';

/** 车模和占位一起拆出首屏包，gltf 还在下的时候才显示占位 */
export default function Su7Deferred() {
  return (
    <Suspense fallback={<Su7LoadingPlaceholder />}>
      <Su7CarPlacement />
    </Suspense>
  );
}
