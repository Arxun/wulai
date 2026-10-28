import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  createDepthDisplaceUniforms,
  createDepthDisplaceVertexShader,
  depthDisplaceFragmentShader,
} from '../shaders/depthDisplace';

/**
 * 一层“带深度的照片”。多层叠加即可做出遮挡补洞的 2.5D 视差效果。
 *
 * @param {object} props
 * @param {string} props.colorUrl 彩色图
 * @param {string} props.depthUrl 深度图（亮 = 近）
 * @param {number} props.aspect 照片 高 / 宽
 * @param {number} props.camDistance 原拍摄相机到照片平面的距离
 * @param {number} props.range 立体强度（世界单位）
 * @param {number} [props.pivot] 落在照片平面上的深度值
 * @param {number} [props.offset] 整层额外后移
 * @param {number} [props.margin] 网格相对照片向四周外扩的比例（背景层遮空隙用）
 * @param {boolean} [props.cut] 是否丢弃被拉伸的三角形
 * @param {number} [props.edgeThr] 判定深度断层的阈值
 * @param {number} [props.segX] 横向网格段数
 * @param {number} [props.renderOrder]
 */
export default function DepthPhotoLayer({
  colorUrl,
  depthUrl,
  aspect,
  camDistance,
  range,
  pivot = 0.78,
  offset = 0,
  margin = 0,
  cut = true,
  edgeThr = 0.07,
  segX = 432,
  renderOrder = 0,
}) {
  const [color, depth] = useTexture([colorUrl, depthUrl]);

  const sizeW = 1 + margin * 2;
  const sizeH = aspect * (1 + margin * 2);

  const geometry = useMemo(() => {
    const sx = Math.round(segX * sizeW);
    const sy = Math.round(sx * (sizeH / sizeW));
    return new THREE.PlaneGeometry(sizeW, sizeH, sx, sy);
  }, [sizeW, sizeH, segX]);

  const vertexShader = useMemo(() => createDepthDisplaceVertexShader(aspect), [aspect]);

  const uniforms = useMemo(
    () =>
      createDepthDisplaceUniforms({ color, depth, camDistance, range, pivot, offset, cut, edgeThr }),
    // 只在贴图变化时重建；其余参数由下面的 effect 直接写 uniform
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, depth, camDistance],
  );

  // 画布像素尺寸（含 dpr），用于判断三角形是否被拉伸
  const size = useThree((st) => st.size);
  const dpr = useThree((st) => st.viewport.dpr);
  useEffect(() => {
    uniforms.uRes.value.set(size.width * dpr, size.height * dpr);
  }, [uniforms, size, dpr]);

  useEffect(() => {
    uniforms.uRange.value = range;
    uniforms.uPivot.value = pivot;
    uniforms.uOffset.value = offset;
    uniforms.uCut.value = cut ? 1 : 0;
    uniforms.uEdgeThr.value = edgeThr;
  }, [uniforms, range, pivot, offset, cut, edgeThr]);

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={renderOrder}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={depthDisplaceFragmentShader}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
