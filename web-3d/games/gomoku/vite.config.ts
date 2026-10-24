import { defineConfig } from 'vite';
import { viteSharedLibPlugin } from '../../scripts/vite-shared-lib-plugin.ts';

export default defineConfig({
  base: './',
  plugins: [viteSharedLibPlugin()],
  server: { host: '0.0.0.0', port: 5192, strictPort: true },
});
