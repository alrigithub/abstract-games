import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5194, strictPort: true },
  optimizeDeps: { exclude: ['@abstract/three-engine'] },
});
