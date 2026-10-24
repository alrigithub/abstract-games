import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const WEB3D_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED_LIB_DIR = path.join(WEB3D_ROOT, 'lib');
const SHARED_LIB_MOUNT = '/lib';

const MIME: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain',
};

function serveSharedLib(req: { url?: string }, res: { statusCode: number; setHeader(n: string, v: string): void; end(): void }, next: () => void) {
  const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
  const rel = decodeURIComponent(urlPath.replace(/^\//, ''));
  const file = path.resolve(SHARED_LIB_DIR, rel);
  if (!file.startsWith(SHARED_LIB_DIR + path.sep) && file !== SHARED_LIB_DIR) {
    res.statusCode = 403;
    res.end();
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    next();
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  createReadStream(file).pipe(res as import('node:stream').Writable);
}

/** Dev server + build: ship {@link WEB3D_ROOT}/lib (pieces + maps) at `./lib/…` in each game dist. */
export function viteSharedLibPlugin(): Plugin {
  let outDir = 'dist';

  return {
    name: 'vite-shared-lib',
    configResolved(config) {
      outDir = path.isAbsolute(config.build.outDir)
        ? config.build.outDir
        : path.join(config.root, config.build.outDir);
    },
    configureServer(server) {
      if (!existsSync(SHARED_LIB_DIR)) return;
      server.middlewares.use(SHARED_LIB_MOUNT, serveSharedLib as (req: unknown, res: unknown, next: () => void) => void);
    },
    closeBundle() {
      if (!existsSync(SHARED_LIB_DIR)) return;
      const target = path.resolve(outDir, 'lib');
      cpSync(SHARED_LIB_DIR, target, { recursive: true });
    },
  };
}
