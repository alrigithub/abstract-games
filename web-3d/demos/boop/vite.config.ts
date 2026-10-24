import { defineConfig } from 'vite';
import { boopEnginePatch } from './vite-boop-engine-patch';

export default defineConfig({
  base: './',
  plugins: [boopEnginePatch()],
  server: { host: '0.0.0.0', port: 5194, strictPort: true },
});
