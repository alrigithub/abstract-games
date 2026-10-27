import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GOMOKU_ARENA_GLB_FILE, GOMOKU_ARENA_GLB_SHA256 } from './gomoku-arena';

const glbPath = join(dirname(fileURLToPath(import.meta.url)), '../../../lib/maps', GOMOKU_ARENA_GLB_FILE);

describe('gomoku arena GLB asset', () => {
  it('matches pinned SHA-256', () => {
    const hash = createHash('sha256').update(readFileSync(glbPath)).digest('hex');
    expect(hash).toBe(GOMOKU_ARENA_GLB_SHA256);
  });
});
