import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useId, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FX_LIGHT_SLOTS, pickFxLights, releaseFxLight, requestFxLight } from './fxLightStore';

/** 与 pointLight 同样的字段（color / intensity / distance / decay / position），但不是真光源 */
class FxLightProxy extends THREE.Object3D {
  constructor() {
    super();
    this.isFxLightProxy = true;
    this.color = new THREE.Color('#ffffff');
    this.intensity = 1;
    this.distance = 0;
    this.decay = 2;
  }
}

/** 自身和所有祖先都可见，且确实挂在场景上 */
function visibleInScene(obj) {
  let o = obj;
  for (; o.parent; o = o.parent) {
    if (!o.visible) return false;
  }
  return o.visible && o.isScene === true;
}

const _pos = new THREE.Vector3();

/** 替代 <pointLight>：每帧把世界坐标、颜色、亮度提交给 FxLightPool */
export const FxLight = forwardRef(function FxLight(props, ref) {
  const key = useId();
  const proxy = useMemo(() => new FxLightProxy(), []);

  useEffect(() => () => releaseFxLight(key), [key]);

  useFrame(() => {
    if (proxy.intensity <= 0.01 || !visibleInScene(proxy)) return;
    proxy.getWorldPosition(_pos);
    requestFxLight(key, _pos.x, _pos.y, _pos.z, proxy.color, proxy.intensity, proxy.distance, proxy.decay);
  });

  return <primitive ref={ref} object={proxy} {...props} />;
});

/** 场景里唯一的一组动态点光，数量恒定，永远 visible */
export function FxLightPool() {
  const lights = useRef([]);
  const slots = useMemo(() => Array.from({ length: FX_LIGHT_SLOTS }, (_, i) => i), []);

  useFrame(({ camera }) => {
    const { x, y, z } = camera.position;
    const chosen = pickFxLights(x, y, z);
    for (let i = 0; i < FX_LIGHT_SLOTS; i++) {
      const light = lights.current[i];
      if (!light) continue;
      const req = chosen[i];
      if (!req) {
        light.intensity = 0;
        continue;
      }
      light.position.set(req.x, req.y, req.z);
      light.color.setRGB(req.r, req.g, req.b);
      light.intensity = req.intensity;
      light.distance = req.distance;
      light.decay = req.decay;
    }
  });

  return (
    <group>
      {slots.map((i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lights.current[i] = el;
          }}
          intensity={0}
          castShadow={false}
        />
      ))}
    </group>
  );
}
