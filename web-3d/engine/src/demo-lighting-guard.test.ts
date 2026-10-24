import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const engineDir = path.dirname(fileURLToPath(import.meta.url));
const web3dRoot = path.resolve(engineDir, '../..');

/** Demo entrypoints and custom scenes must not add their own Three.js lighting or renderer tone mapping. */
const DEMO_SOURCE_ROOTS = [
  path.join(web3dRoot, 'demos/boop/src'),
  path.join(web3dRoot, 'demos/yinsh/src'),
  path.join(web3dRoot, 'demos/tzaar/src'),
  path.join(web3dRoot, 'demos/gomoku/src'),
  path.join(web3dRoot, 'tak/src'),
];

const SOURCE_EXT = new Set(['.ts', '.tsx']);

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkSourceFiles(full));
    else if (SOURCE_EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

function collectDemoSources(): string[] {
  return DEMO_SOURCE_ROOTS.flatMap(root => walkSourceFiles(root));
}

describe('demo lighting guard', () => {
  it('demos do not instantiate Three.js lights', () => {
    const lightPattern =
      /new\s+THREE\.(?:Hemisphere|Directional|Ambient|Point|Spot|RectArea)Light\b/;
    for (const file of collectDemoSources()) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(lightPattern);
    }
  });

  it('demos do not configure renderer tone mapping locally', () => {
    const tonePattern = /\.toneMapping\s*=|ACESFilmicToneMapping|toneMappingExposure/;
    for (const file of collectDemoSources()) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(tonePattern);
    }
  });

  it('custom WebGLRenderer usage goes through shared board renderer helpers', () => {
    const rendererPattern = /new\s+THREE\.WebGLRenderer\b/;
    for (const file of collectDemoSources()) {
      const text = readFileSync(file, 'utf8');
      if (!rendererPattern.test(text)) continue;
      const usesShared =
        text.includes('createBoardWebGLRenderer') ||
        text.includes('configureBoardWebGLRenderer') ||
        text.includes('createBoardScene');
      expect(usesShared, `${file} must use createBoardWebGLRenderer / configureBoardWebGLRenderer / createBoardScene`).toBe(true);
    }
  });
});
