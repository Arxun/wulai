import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';

/** 父容器尺寸变化或 Canvas remount 后，强制按 clientWidth/Height 重设 gl 缓冲区 */
export default function MobileCanvasResize() {
  const gl = useThree((s) => s.gl);
  const setSize = useThree((s) => s.setSize);

  useLayoutEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;

    const apply = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w > 0 && h > 0) setSize(w, h);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [gl, setSize]);

  return null;
}
