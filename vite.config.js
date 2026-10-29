/*
 * @Author: dongxun dongxun@quicktron.com
 * @Date: 2026-10-28 16:57:39
 * @LastEditors: dongxun dongxun@quicktron.com
 * @LastEditTime: 2026-10-28 17:38:08
 * @Description:
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/wulai/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 业务代码交给 Rollup 按动态 import 自动拆：game 和 lowpoly/person 互相引用，
          // 按目录硬拆会形成循环包，生产环境报 "Cannot access ... before initialization"
          if (!id.includes('node_modules')) return undefined;
          // 勿用 includes('three')：会误匹配 @react-three/fiber
          if (/\/node_modules\/three\//.test(id)) return 'three';
          if (id.includes('@react-three/fiber')) return 'r3f';
          if (id.includes('@react-three/drei')) return 'drei';
          return undefined;
        },
      },
    },
  },
});
