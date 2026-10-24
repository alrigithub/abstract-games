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

export const BOOP_UPGRADE_SFX_URL = assetUrl('boop', 'boop-upgrade.mp3');

export const BOOP_WIN_SFX_URL = assetUrl('boop', 'boop-win.mp3');

const KNOCK_SINGLE_FILES = ['knock-1a.mp3', 'knock-1b.mp3', 'knock-1c.mp3', 'knock-1d.mp3', 'knock-1e.mp3'] as const;
const KNOCK_THREE_FILES = ['knock-3a.mp3', 'knock-3b.mp3'] as const;
const KNOCK_FOUR_FILE = 'knock-4.mp3' as const;

const knockUrl = (file: string) => `${import.meta.env.BASE_URL}assets/sfx/boop/knock/${file}`;

export const BOOP_KNOCK_SINGLE_SFX_URLS: readonly string[] = KNOCK_SINGLE_FILES.map(knockUrl);
export const BOOP_KNOCK_THREE_SFX_URLS: readonly string[] = KNOCK_THREE_FILES.map(knockUrl);
export const BOOP_KNOCK_FOUR_SFX_URL = knockUrl(KNOCK_FOUR_FILE);

export const BOOP_DEMO_SFX_MANIFEST = {
  place: PLACE_HIT_FILES,
  boop: BOOP_SWOOSH_FILES,
  knockSingle: KNOCK_SINGLE_FILES,
  knockThree: KNOCK_THREE_FILES,
  knockFour: KNOCK_FOUR_FILE,
} as const;
