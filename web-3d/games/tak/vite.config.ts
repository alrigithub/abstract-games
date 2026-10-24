import { defineConfig } from 'vite';
import { viteSharedLibPlugin } from '../../scripts/vite-shared-lib-plugin.ts';

export default defineConfig({
  base: './',
  plugins: [viteSharedLibPlugin()],
  server: { host: '0.0.0.0', port: 5190, strictPort: true },
  preview: { host: '0.0.0.0', port: 5191, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
