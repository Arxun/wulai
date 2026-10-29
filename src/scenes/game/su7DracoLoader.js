import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { publicUrl } from '../../lib/publicUrl';

/** 为 GLTFLoader 配置 Draco（解码器随 public/draco 发布） */
export function configureSu7GltfLoader(loader) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(publicUrl('/draco/gltf/'));
  loader.setDRACOLoader(draco);
}
