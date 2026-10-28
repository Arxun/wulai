import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

/**
 * 小幅度环绕相机：鼠标 / 手指移动 → 相机在以 target 为中心、半径 distance 的球面上缓动；
 * 静止一段时间后（auto 开启时）自动轻摇。适合“2.5D 照片视差”这类只允许小角度看的场景。
 *
 * @param {object} o
 * @param {number} o.distance 相机到 target 的距离
 * @param {boolean} [o.auto] 静止后是否自动轻摇
 * @param {number} [o.maxYaw] 左右最大摆角（弧度）
 * @param {number} [o.maxPitch] 上下最大摆角（弧度）
 * @param {number} [o.idleMs] 多久没操作算“静止”
 * @param {[number, number, number]} [o.target] 注视点
 */
export default function useParallaxCamera({
  distance,
  auto = true,
  maxYaw = 0.22,
  maxPitch = 0.1,
  idleMs = 2500,
  target = [0, 0, 0],
}) {
  const { camera, gl } = useThree();
  const pointer = useRef({ x: 0, y: 0 }); // 归一化指针位置 [-1, 1]
  const current = useRef({ x: 0, y: 0 }); // 缓动后的当前值
  const lastMove = useRef(-1e9);

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      pointer.current.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.current.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      lastMove.current = performance.now();
    };
    const onLeave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [gl]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    let tx = pointer.current.x;
    let ty = pointer.current.y;
    if (auto && performance.now() - lastMove.current > idleMs) {
      tx = Math.sin(t * 0.7);
      ty = Math.sin(t * 0.45) * 0.6;
    }
    current.current.x += (tx - current.current.x) * 0.06;
    current.current.y += (ty - current.current.y) * 0.06;

    const yaw = current.current.x * maxYaw;
    const pitch = -current.current.y * maxPitch;
    camera.position.set(
      target[0] + Math.sin(yaw) * Math.cos(pitch) * distance,
      target[1] + Math.sin(pitch) * distance,
      target[2] + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.lookAt(target[0], target[1], target[2]);
  });
}
