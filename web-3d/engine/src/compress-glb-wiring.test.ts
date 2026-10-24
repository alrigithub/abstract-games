import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const engineDir = path.dirname(fileURLToPath(import.meta.url));
const web3dRoot = path.resolve(engineDir, '../..');
const repoRoot = path.resolve(web3dRoot, '..');

const LIFECYCLE_PREFIXES = ['pre', 'post', 'prepare', 'install', 'preinstall', 'postinstall'];

function findPackageJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      out.push(...findPackageJsonFiles(full));
    } else if (name === 'package.json') out.push(full);
  }
  return out;
}

function lifecycleScriptHits(pkgPath: string): string[] {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
  const hits: string[] = [];
  for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
    if (name === 'compress-glb') continue;
    const isLifecycle =
      LIFECYCLE_PREFIXES.some(prefix => name === prefix || name.startsWith(prefix)) ||
      ['build', 'test', 'dev'].includes(name);
    if (isLifecycle && /compress-glb|compress-glb\.mjs/.test(cmd)) {
      hits.push(`${path.relative(repoRoot, pkgPath)} scripts.${name}`);
    }
  }
  return hits;
}

describe('compress-glb wiring', () => {
  it('is not invoked from npm lifecycle, build, test, or dev scripts', () => {
    const hits = findPackageJsonFiles(web3dRoot).flatMap(lifecycleScriptHits);
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('is not invoked from CI or hosting stage scripts', () => {
    const ciPath = path.join(repoRoot, '.github/workflows/ci.yml');
    const stagePath = path.join(repoRoot, 'scripts/stage_web3d_hosting.sh');
    const ci = readFileSync(ciPath, 'utf8');
    const stage = readFileSync(stagePath, 'utf8');
    expect(ci).not.toMatch(/compress-glb/);
    expect(stage).not.toMatch(/compress-glb/);
  });
});
