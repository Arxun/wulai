import { useGLTF, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { collectMeshes, ensureVec3Colors, normalizeModel } from '../three/normalizeModel';
import { createPhotoProjectedMaterial, renderProjectionDepth } from '../shaders/photoProjection';

/**
 * 加载 GLB（顶点色），并把原照片以“投影贴图 + 遮挡检测”的方式贴回正面。
 * 看不到照片的部分（侧面、背面、被挡住的地方）使用 GLB 里由模型补全的顶点色。
 *
 * @param {object} props
 * @param {string} props.glbUrl 模型
 * @param {string} props.photoUrl 原照片
 * @param {number[]} props.projMatrix 列主序 16 个数：模型空间 → 照片相机裁剪空间
 * @param {number[]} [props.frontDir] 模型空间里朝向拍摄相机的方向
 * @param {boolean} [props.usePhoto] false 时只显示顶点色（对比用）
 * @param {number} [props.height] 归一化后的模型高度
 * @param {(info: { height: number }) => void} [props.onReady]
 */
export default function PhotoProjectedModel({
  glbUrl,
  photoUrl,
  projMatrix,
  frontDir = [0, 0, 1],
  usePhoto = true,
  height = 1.8,
  onReady,
}) {
  const gltf = useGLTF(glbUrl, false); // 不走 Draco，避免去 CDN 拉解码器
  const photo = useTexture(photoUrl);
  const gl = useThree((s) => s.gl);

  // 每个组件实例用自己的克隆，避免 useGLTF 缓存里的场景被反复改动
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  const meshes = useMemo(() => collectMeshes(scene), [scene]);

  // 材质与深度预渲染：模型 / 照片 / 矩阵变化时才重建
  const material = useMemo(() => {
    meshes.forEach((m) => ensureVec3Colors(m.geometry));
    const m4 = new THREE.Matrix4().fromArray(projMatrix);
    const depth = renderProjectionDepth(
      gl,
      meshes.map((m) => m.geometry),
      m4,
    );
    const mat = createPhotoProjectedMaterial({
      photo,
      projMatrix: m4,
      depthTexture: depth.target.texture,
      frontDir: new THREE.Vector3(...frontDir),
    });
    mat.userData.disposeDepth = depth.dispose;
    return mat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, meshes, photo, projMatrix]);

  useEffect(
    () => () => {
      material.userData.disposeDepth?.();
      material.dispose();
    },
    [material],
  );

  useEffect(() => {
    meshes.forEach((m) => {
      m.material = material;
    });
  }, [meshes, material]);

  useEffect(() => {
    material.uniforms.uMix.value = usePhoto ? 1 : 0;
  }, [material, usePhoto]);

  // 归一化尺寸（只改根节点 transform，不影响着色器用的局部坐标）
  useEffect(() => {
    normalizeModel(scene, height);
    onReady?.({ height });
  }, [scene, height, onReady]);

  return <primitive object={scene} />;
}
