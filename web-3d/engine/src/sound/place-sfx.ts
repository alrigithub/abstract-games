export const PLACE_SFX_STORAGE_KEY = 'abstract-three-place-sound';

const CLIP_COUNT = 6;

export const PLACE_SFX_URLS: readonly string[] = Array.from({ length: CLIP_COUNT }, (_, i) =>
  new URL(`../../assets/sfx/place-${i + 1}.mp3`, import.meta.url).href,
);

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
let audioContext: AudioContext | null = null;
let buffers: AudioBuffer[] | null = null;
let loadPromise: Promise<void> | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

async function loadBuffers(): Promise<void> {
  if (buffers) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const decoded = await Promise.all(
    PLACE_SFX_URLS.map(async url => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`place sfx fetch failed: ${url}`);
      const data = await res.arrayBuffer();
      return ctx.decodeAudioData(data.slice(0));
    }),
  );
  buffers = decoded;
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
