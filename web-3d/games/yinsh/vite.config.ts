import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  optimizeDeps: { exclude: ['@abstract/three-engine'] },
  server: { host: '0.0.0.0', port: 5196, strictPort: true },
});
