import { defineConfig } from 'vite';
import { viteSharedLibPlugin } from '../../scripts/vite-shared-lib-plugin.ts';

export default defineConfig({
  base: './',
  plugins: [viteSharedLibPlugin()],
  optimizeDeps: { exclude: ['@abstract/three-engine'] },
  server: { host: '0.0.0.0', port: 5196, strictPort: true },
});
