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
});
