/** Boop demo placement hits (Tak hit pack) and push swooshes served from `public/assets/sfx/`. */
const PLACE_HIT_FILES = [
  'tak-0748-hit-01.mp3',
  'tak-0748-hit-02.mp3',
  'tak-0748-hit-03.mp3',
  'tak-0748-hit-04.mp3',
  'tak-0748-hit-05.mp3',
  'tak-0748-hit-06.mp3',
] as const;

const BOOP_SWOOSH_FILES = [
  'swoosh-01.mp3',
  'swoosh-02.mp3',
  'swoosh-03.mp3',
  'swoosh-04.mp3',
  'swoosh-05.mp3',
  'swoosh-06.mp3',
] as const;

const assetUrl = (folder: 'place' | 'boop', file: string) =>
  `${import.meta.env.BASE_URL}assets/sfx/${folder}/${file}`;

export const BOOP_DEMO_PLACE_SFX_URLS: readonly string[] = PLACE_HIT_FILES.map(f => assetUrl('place', f));

export const BOOP_DEMO_BOOP_SFX_URLS: readonly string[] = BOOP_SWOOSH_FILES.map(f => assetUrl('boop', f));

export const BOOP_DEMO_SFX_MANIFEST = {
  place: PLACE_HIT_FILES,
  boop: BOOP_SWOOSH_FILES,
} as const;
