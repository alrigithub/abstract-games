import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  DEFAULT_AI_STRENGTH_LEVELS,
  levelToSearchOptions,
  readStoredAiStrengthIndex,
  storeAiStrengthIndex,
} from './ai-strength';

describe('ai-strength', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    });
  });

  it('persists level index', () => {
    storeAiStrengthIndex('test-ai', 2);
    expect(readStoredAiStrengthIndex('test-ai', 4)).toBe(2);
  });

  it('maps level to search options', () => {
    const hard = DEFAULT_AI_STRENGTH_LEVELS.find(l => l.id === 'hard')!;
    expect(levelToSearchOptions(hard)).toEqual({
      maxDepth: 6,
      maxNodes: 28_000,
      maxTimeMs: 3_000,
    });
  });
});
