/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as placeSfx from './place-sfx';
import {
  PLACE_SFX_STORAGE_KEY,
  pickPlaceClipIndex,
  pickWinClipIndex,
  readPlaceSoundEnabled,
  setPlaceSoundEnabled,
  writePlaceSoundEnabled,
} from './place-sfx';

describe('pickPlaceClipIndex', () => {
  it('never repeats the previous clip when more than one exists', () => {
    for (let last = 0; last < 6; last++) {
      for (let i = 0; i < 40; i++) {
        const idx = pickPlaceClipIndex(last, () => 0.99);
        expect(idx).not.toBe(last);
      }
    }
  });

  it('uses the only clip when count is 1', () => {
    expect(pickPlaceClipIndex(0, () => 0.5, 1)).toBe(0);
  });
});

describe('boop push landing batch', () => {
  afterEach(() => {
    placeSfx.endBoopPushLandSounds();
    placeSfx.endBoopPushLandSounds();
    vi.restoreAllMocks();
  });

  it('handles first pushed landing in a batch instead of a place clip', () => {
    expect(placeSfx.consumeBoopPushLandingSound()).toBe(true);

    placeSfx.beginBoopPushLandSounds();
    expect(placeSfx.consumeBoopPushLandingSound()).toBe(false);
    expect(placeSfx.consumeBoopPushLandingSound()).toBe(false);

    placeSfx.endBoopPushLandSounds();
    expect(placeSfx.consumeBoopPushLandingSound()).toBe(true);
  });
});

describe('pickWinClipIndex', () => {
  it('never repeats the previous clip', () => {
    for (let last = 0; last < 2; last++) {
      for (let i = 0; i < 20; i++) {
        expect(pickWinClipIndex(last, () => 0.99)).not.toBe(last);
      }
    }
  });
});

describe('place sound preference', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to enabled', () => {
    expect(readPlaceSoundEnabled()).toBe(true);
  });

  it('persists off and on', () => {
    writePlaceSoundEnabled(false);
    expect(readPlaceSoundEnabled()).toBe(false);
    setPlaceSoundEnabled(true);
    expect(localStorage.getItem(PLACE_SFX_STORAGE_KEY)).toBe('on');
    expect(readPlaceSoundEnabled()).toBe(true);
  });
});
