import { describe, expect, it } from 'vitest';
import { resolveBoopLighting } from './boop-lighting';

describe('Boop lighting preference', () => {
  it('defaults to the requested clear daylight look', () => {
    expect(resolveBoopLighting(null, null)).toBe('daylight');
    expect(resolveBoopLighting('invalid', 'invalid')).toBe('daylight');
  });
  it('honors shareable links before a saved preference', () => {
    expect(resolveBoopLighting('soft-studio', 'warm-gallery')).toBe('soft-studio');
    expect(resolveBoopLighting(null, 'warm-gallery')).toBe('warm-gallery');
    expect(resolveBoopLighting('toString', null)).toBe('daylight');
  });
});
