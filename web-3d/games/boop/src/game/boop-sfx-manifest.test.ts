import { describe, expect, it } from 'vitest';
import {
  BOOP_DEMO_BOOP_SFX_URLS,
  BOOP_DEMO_PLACE_SFX_URLS,
  BOOP_DEMO_SFX_MANIFEST,
  BOOP_UPGRADE_SFX_URL,
} from './boop-sfx-manifest';

describe('boop sfx manifest', () => {
  it('lists six placement hits and six boop swooshes', () => {
    expect(BOOP_DEMO_SFX_MANIFEST.place).toHaveLength(6);
    expect(BOOP_DEMO_SFX_MANIFEST.boop).toHaveLength(6);
    expect(BOOP_DEMO_PLACE_SFX_URLS).toHaveLength(6);
    expect(BOOP_DEMO_BOOP_SFX_URLS).toHaveLength(6);
  });

  it('resolves public asset paths', () => {
    for (const url of BOOP_DEMO_PLACE_SFX_URLS) {
      expect(url).toContain('assets/sfx/place/tak-0748-hit-');
      expect(url).toMatch(/tak-0748-hit-\d{2}\.mp3$/);
    }
    for (const url of BOOP_DEMO_BOOP_SFX_URLS) {
      expect(url).toContain('assets/sfx/boop/swoosh-');
      expect(url).toMatch(/swoosh-\d{2}\.mp3$/);
    }
    expect(BOOP_UPGRADE_SFX_URL).toContain('assets/sfx/boop/boop-upgrade.mp3');
  });
});
