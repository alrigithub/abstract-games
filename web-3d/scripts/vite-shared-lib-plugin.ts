import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const WEB3D_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED_LIB_DIR = path.join(WEB3D_ROOT, 'lib');
const SHARED_LIB_MOUNT = '/lib';
const HUB_IMG_DIR = path.join(WEB3D_ROOT, 'hub', 'img');
const HUB_IMG_MOUNT = '/img';

const MIME: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.png': 'image/png',
};

function serveStaticDir(
  rootDir: string,
  req: { url?: string },
  res: { statusCode: number; setHeader(n: string, v: string): void; end(): void },
  next: () => void,
) {
  const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
  const rel = decodeURIComponent(urlPath.replace(/^\//, ''));
  const file = path.resolve(rootDir, rel);
  if (!file.startsWith(rootDir + path.sep) && file !== rootDir) {
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

function serveSharedLib(req: { url?: string }, res: { statusCode: number; setHeader(n: string, v: string): void; end(): void }, next: () => void) {
  serveStaticDir(SHARED_LIB_DIR, req, res, next);
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
      if (existsSync(SHARED_LIB_DIR)) {
        server.middlewares.use(SHARED_LIB_MOUNT, serveSharedLib as (req: unknown, res: unknown, next: () => void) => void);
      }
      if (existsSync(HUB_IMG_DIR)) {
        server.middlewares.use(
          HUB_IMG_MOUNT,
          ((req: unknown, res: unknown, next: () => void) =>
            serveStaticDir(HUB_IMG_DIR, req as { url?: string }, res as { statusCode: number; setHeader(n: string, v: string): void; end(): void }, next)) as (
            req: unknown,
            res: unknown,
            next: () => void,
          ) => void,
        );
      }
    },
    closeBundle() {
      if (!existsSync(SHARED_LIB_DIR)) return;
      const target = path.resolve(outDir, 'lib');
      cpSync(SHARED_LIB_DIR, target, { recursive: true });
    },
  };
}
