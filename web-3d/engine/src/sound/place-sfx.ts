export const PLACE_SFX_STORAGE_KEY = 'abstract-three-place-sound';

const CLIP_COUNT = 6;
const WIN_CLIP_COUNT = 2;

export const PLACE_SFX_URLS: readonly string[] = Array.from({ length: CLIP_COUNT }, (_, i) =>
  new URL(`../../assets/sfx/place-${i + 1}.mp3`, import.meta.url).href,
);

export const WIN_SFX_URLS: readonly string[] = Array.from({ length: WIN_CLIP_COUNT }, (_, i) =>
  new URL(`../../assets/sfx/win-${i + 1}.mp3`, import.meta.url).href,
);

export const BOOP_SFX_URL = new URL('../../assets/sfx/boop.mp3', import.meta.url).href;

export interface PlaceSfxPools {
  place: readonly string[];
  boop: readonly string[];
}

let configuredPools: PlaceSfxPools | null = null;

/** Override default engine clip URLs (call before {@link initPlaceSfx}). */
export function configurePlaceSfxPools(pools: PlaceSfxPools): void {
  if (initDone) {
    throw new Error('configurePlaceSfxPools must run before initPlaceSfx');
  }
  configuredPools = pools;
}

function resolvedPlaceUrls(): readonly string[] {
  return configuredPools?.place ?? PLACE_SFX_URLS;
}

function resolvedBoopUrls(): readonly string[] {
  return configuredPools?.boop ?? [BOOP_SFX_URL];
}

/** Delay after a placement landing before win SFX (avoids clashing with place clips). */
export const WIN_SOUND_AFTER_PLACE_DELAY_MS = 220;

export type PlaceSoundKind = 'place' | 'cancel';

export interface PlayPiecePlaceSoundOptions {
  kind?: PlaceSoundKind;
}

/** Pick clip index in [0, count); never repeats {@link lastIndex} when count > 1. */
export function pickPlaceClipIndex(lastIndex: number | null, random: () => number, count = CLIP_COUNT): number {
  if (count <= 1) return 0;
  let idx = Math.floor(random() * count);
  if (lastIndex !== null && idx === lastIndex) idx = (idx + 1 + Math.floor(random() * (count - 1))) % count;
  return idx;
}

export function pickWinClipIndex(lastIndex: number | null, random: () => number): number {
  return pickPlaceClipIndex(lastIndex, random, WIN_CLIP_COUNT);
}

export function readPlaceSoundEnabled(storageKey = PLACE_SFX_STORAGE_KEY): boolean {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === 'off') return false;
    if (raw === 'on') return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function writePlaceSoundEnabled(enabled: boolean, storageKey = PLACE_SFX_STORAGE_KEY): void {
  try {
    localStorage.setItem(storageKey, enabled ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

let initDone = false;
let enabled = true;
let lastClipIndex: number | null = null;
let lastWinClipIndex: number | null = null;
let audioContext: AudioContext | null = null;
let buffers: AudioBuffer[] | null = null;
let winBuffers: AudioBuffer[] | null = null;
let boopBuffers: AudioBuffer[] | null = null;
let loadPromise: Promise<void> | null = null;
let boopPushBatchDepth = 0;
let lastBoopClipIndex: number | null = null;
let boopPushLandingPlayer: (() => void) | null = null;

/** Override push-landing audio during {@link beginBoopPushLandSounds} (game-specific knock clips). */
export function setBoopPushLandingSoundPlayer(player: (() => void) | null): void {
  boopPushLandingPlayer = player;
}

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

async function decodeClip(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sfx fetch failed: ${url}`);
  const data = await res.arrayBuffer();
  return ctx.decodeAudioData(data.slice(0));
}

async function loadBuffers(): Promise<void> {
  if (buffers && winBuffers && boopBuffers) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const placeUrls = resolvedPlaceUrls();
  const boopUrls = resolvedBoopUrls();
  const [place, win, boop] = await Promise.all([
    buffers ? Promise.resolve(buffers) : Promise.all(placeUrls.map(url => decodeClip(ctx, url))),
    winBuffers
      ? Promise.resolve(winBuffers)
      : Promise.all(WIN_SFX_URLS.map(url => decodeClip(ctx, url))),
    boopBuffers ? Promise.resolve(boopBuffers) : Promise.all(boopUrls.map(url => decodeClip(ctx, url))),
  ]);
  buffers = place;
  winBuffers = win;
  boopBuffers = boop;
}

function unlockAudioContext(): void {
  const ctx = ensureContext();
  if (!ctx || ctx.state === 'running') return;
  void ctx.resume();
}

/** Preload clips and attach a one-time pointer unlock (call from shared UI / board scene). */
export function initPlaceSfx(): void {
  if (initDone || typeof window === 'undefined') return;
  initDone = true;
  enabled = readPlaceSoundEnabled();
  loadPromise = loadBuffers().catch(() => {
    buffers = null;
    winBuffers = null;
    boopBuffers = null;
  });
  const unlock = () => {
    unlockAudioContext();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

export function setPlaceSoundEnabled(next: boolean): void {
  enabled = next;
  writePlaceSoundEnabled(next);
  if (next) unlockAudioContext();
}

export function isPlaceSoundEnabled(): boolean {
  return enabled;
}

/** Play a placement landing sound (no-op when disabled or not yet unlocked). */
export function playPiecePlaceSound(options: PlayPiecePlaceSoundOptions = {}): void {
  if (!enabled || typeof window === 'undefined') return;
  const kind = options.kind ?? 'place';
  const run = async () => {
    await loadPromise;
    const ctx = ensureContext();
    if (!ctx || !buffers?.length) return;
    unlockAudioContext();
    if (ctx.state !== 'running') return;

    const index = pickPlaceClipIndex(lastClipIndex, Math.random, buffers.length);
    lastClipIndex = index;
    const buffer = buffers[index]!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const baseGain = kind === 'cancel' ? 0.35 : 1;
    gain.gain.value = baseGain * (0.88 + Math.random() * 0.18);
    source.playbackRate.value = 0.94 + Math.random() * 0.12;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  };
  void run();
}

/** While active, the first pushed-piece landing plays {@link playBoopSound} instead of a place clip. */
export function beginBoopPushLandSounds(): void {
  boopPushBatchDepth++;
}

export function endBoopPushLandSounds(): void {
  if (boopPushBatchDepth > 0) boopPushBatchDepth--;
}

export function isBoopPushLandingBatchActive(): boolean {
  return boopPushBatchDepth > 0;
}

/**
 * Called when a piece landing would play a place clip.
 * @returns false when the landing sound was handled (boop batch) and place SFX should be skipped.
 */
export function consumeBoopPushLandingSound(): boolean {
  if (boopPushBatchDepth <= 0) return true;
  if (boopPushLandingPlayer) boopPushLandingPlayer();
  else playBoopSound();
  return false;
}

/** Boop push sting (no-op when Sound is off or audio not unlocked). */
export function playBoopSound(): void {
  if (!enabled || typeof window === 'undefined') return;
  const run = async () => {
    await loadPromise;
    const ctx = ensureContext();
    if (!ctx || !boopBuffers?.length) return;
    unlockAudioContext();
    if (ctx.state !== 'running') return;

    const index = pickPlaceClipIndex(lastBoopClipIndex, Math.random, boopBuffers.length);
    lastBoopClipIndex = index;
    const buffer = boopBuffers[index]!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.95 + Math.random() * 0.1;
    source.playbackRate.value = 0.98 + Math.random() * 0.06;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  };
  void run();
}

/** Play a win sting (no-op when Sound is off or audio not unlocked). */
export function playWinSound(): void {
  if (!enabled || typeof window === 'undefined') return;
  const run = async () => {
    await loadPromise;
    const ctx = ensureContext();
    if (!ctx || !winBuffers?.length) return;
    unlockAudioContext();
    if (ctx.state !== 'running') return;

    const index = pickWinClipIndex(lastWinClipIndex, Math.random);
    lastWinClipIndex = index;
    const buffer = winBuffers[index]!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.92 + Math.random() * 0.16;
    source.playbackRate.value = 0.96 + Math.random() * 0.08;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  };
  void run();
}

/** Win sting shortly after the placement landing sound finishes its attack. */
export function playWinSoundAfterPlace(): void {
  if (!enabled || typeof window === 'undefined') return;
  window.setTimeout(() => playWinSound(), WIN_SOUND_AFTER_PLACE_DELAY_MS);
}
