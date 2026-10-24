import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5190, strictPort: true },
  preview: { host: '0.0.0.0', port: 5191, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
