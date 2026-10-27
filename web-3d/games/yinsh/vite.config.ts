import { defineConfig } from 'vite';
import { viteSharedLibPlugin } from '../../scripts/vite-shared-lib-plugin.ts';

const yinshPieces = [
  'yinsh-ring-white.glb',
  'yinsh-ring-black.glb',
  'yinsh-marker-white.glb',
  'yinsh-marker-black.glb',
];

export default defineConfig({
  base: './',
  plugins: [viteSharedLibPlugin({ include: yinshPieces.map(name => `pieces/${name}`) })],
  optimizeDeps: { exclude: ['@abstract/three-engine'] },
  server: { host: '0.0.0.0', port: 5196, strictPort: true },
});
