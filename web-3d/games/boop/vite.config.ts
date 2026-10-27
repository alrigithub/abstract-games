import { defineConfig } from 'vite';
import { viteSharedLibPlugin } from '../../scripts/vite-shared-lib-plugin.ts';
import { BOOP_VASE_GLB } from './src/game/boop-vase-assets';

const boopPieces = Object.values(BOOP_VASE_GLB).flatMap(byKind => Object.values(byKind));

export default defineConfig({
  base: './',
  plugins: [viteSharedLibPlugin({ include: boopPieces.map(name => `pieces/${name}`) })],
  server: { host: '0.0.0.0', port: 5194, strictPort: true },
  optimizeDeps: { exclude: ['@abstract/three-engine'] },
});
