import {
  isPlaceSoundEnabled,
  pickPlaceClipIndex,
  setBoopPushLandingSoundPlayer,
} from '@abstract/three-engine';
import {
  BOOP_KNOCK_FOUR_SFX_URL,
  BOOP_KNOCK_SINGLE_SFX_URLS,
  BOOP_KNOCK_THREE_SFX_URLS,
} from './boop-sfx-manifest';

type KnockLandingMode = 'single' | 'none';

let audioContext: AudioContext | null = null;
let loadPromise: Promise<void> | null = null;
let singleBuffers: AudioBuffer[] | null = null;
let threeBuffers: AudioBuffer[] | null = null;
let fourBuffer: AudioBuffer | null = null;
let lastSingleIndex: number | null = null;
let landingMode: KnockLandingMode = 'none';

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

function unlockAudioContext(): void {
  const ctx = ensureContext();
  if (!ctx || ctx.state === 'running') return;
  void ctx.resume();
}

async function decode(url: string): Promise<AudioBuffer | null> {
  const ctx = ensureContext();
  if (!ctx) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.arrayBuffer();
  return ctx.decodeAudioData(data.slice(0));
}

async function loadKnockBuffers(): Promise<void> {
  if (singleBuffers && threeBuffers && fourBuffer) return;
  const [single, three, four] = await Promise.all([
    singleBuffers
      ? Promise.resolve(singleBuffers)
      : Promise.all(BOOP_KNOCK_SINGLE_SFX_URLS.map(url => decode(url))).then(b => b.filter((x): x is AudioBuffer => !!x)),
    threeBuffers
      ? Promise.resolve(threeBuffers)
      : Promise.all(BOOP_KNOCK_THREE_SFX_URLS.map(url => decode(url))).then(b => b.filter((x): x is AudioBuffer => !!x)),
    fourBuffer ? Promise.resolve(fourBuffer) : decode(BOOP_KNOCK_FOUR_SFX_URL),
  ]);
  singleBuffers = single.length ? single : null;
  threeBuffers = three.length ? three : null;
  fourBuffer = four;
}

function playBuffer(buffer: AudioBuffer, gainBase = 0.95): void {
  const ctx = ensureContext();
  if (!ctx) return;
  unlockAudioContext();
  if (ctx.state !== 'running') return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = gainBase + Math.random() * 0.1;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
}

function playRandomSingleKnock(): void {
  if (!singleBuffers?.length) return;
  const index = pickPlaceClipIndex(lastSingleIndex, Math.random, singleBuffers.length);
  lastSingleIndex = index;
  playBuffer(singleBuffers[index]!);
}

function onPushPieceLanding(): void {
  if (landingMode === 'single') playRandomSingleKnock();
}

function playKnockAtPushStart(pushedCount: number): void {
  if (pushedCount >= 4 && fourBuffer) {
    playBuffer(fourBuffer);
    return;
  }
  if (pushedCount === 3 && threeBuffers?.length) {
    const idx = Math.floor(Math.random() * threeBuffers.length);
    playBuffer(threeBuffers[idx]!);
  }
}

/** Wire engine push-landing hook; call once at startup. */
export function initBoopKnockPushSounds(): void {
  if (typeof window === 'undefined') return;
  setBoopPushLandingSoundPlayer(() => {
    if (!isPlaceSoundEnabled()) return;
    void (async () => {
      loadPromise ??= loadKnockBuffers();
      await loadPromise;
      onPushPieceLanding();
    })();
  });
}

/** Count = displacements + off-board exits in this boop move. */
export function beginBoopKnockPushBatch(pushedCount: number): void {
  if (!isPlaceSoundEnabled() || pushedCount <= 0) {
    landingMode = 'none';
    return;
  }
  if (pushedCount >= 3) {
    landingMode = 'none';
    void (async () => {
      loadPromise ??= loadKnockBuffers();
      await loadPromise;
      playKnockAtPushStart(pushedCount);
    })();
    return;
  }
  landingMode = 'single';
}

export function endBoopKnockPushBatch(): void {
  landingMode = 'none';
}
