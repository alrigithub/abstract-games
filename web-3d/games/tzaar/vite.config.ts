import { defineConfig } from 'vite';
import { viteSharedLibPlugin } from '../../scripts/vite-shared-lib-plugin.ts';

const tzaarPieces = [
  'tzaar-tzaar-white.glb',
  'tzaar-tzaar-black.glb',
  'tzaar-tzarra-white.glb',
  'tzaar-tzarra-black.glb',
  'tzaar-tott-white.glb',
  'tzaar-tott-black.glb',
];

export default defineConfig({
  base: './',
  plugins: [viteSharedLibPlugin({ include: tzaarPieces.map(name => `pieces/${name}`) })],
  server: { host: '0.0.0.0', port: 5199, strictPort: true },
});
