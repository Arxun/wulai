import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { floats } from './stores/combatStore';

/**
 * 头顶伤害数字。用一张小 canvas 做成 sprite，
 * 冒出来的时候先胀一下再往上飘、淡出。
 */

const POOL = 28;

function makeTex(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);
  ctx.font = '800 78px "Avenir Next", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(12, 8, 6, 0.88)';
  ctx.strokeText(text, 128, 68);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function FloatTexts() {
  const refs = useRef([]);
  const cache = useMemo(() => new Map(), []);

  useFrame((_, dtRaw) => {
    if (floats.length === 0) return;
    const dt = Math.min(dtRaw, 0.05);
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].age += dt;
      if (floats[i].age >= floats[i].life) floats.splice(i, 1);
    }
    for (let i = 0; i < POOL; i++) {
      const spr = refs.current[i];
      if (!spr) continue;
      const f = floats[i];
      if (!f) {
        spr.visible = false;
        continue;
      }
      if (!f.tex) {
        const key = `${f.text}|${f.color}`;
        let tex = cache.get(key);
        if (!tex) {
          tex = makeTex(f.text, f.color);
          cache.set(key, tex);
        }
        f.tex = tex;
        spr.material.map = tex;
        spr.material.needsUpdate = true;
      }
      const t = f.age / f.life;
      const pop = t < 0.16 ? 0.55 + (t / 0.16) * 0.85 : 1.28 - (t - 0.16) * 0.35;
      const fade = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.48) / 0.52);
      spr.visible = true;
      spr.position.set(f.x + f.jx * t, f.y + t * 1.45, f.z);
      spr.scale.setScalar(0.58 * pop * f.scale);
      spr.material.opacity = fade;
    }
  });

  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <sprite key={i} ref={(el) => { refs.current[i] = el; }} visible={false}>
          <spriteMaterial transparent depthTest={false} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}
