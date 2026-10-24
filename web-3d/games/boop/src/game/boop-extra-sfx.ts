import { isPlaceSoundEnabled } from '@abstract/three-engine';
import { BOOP_UPGRADE_SFX_URL } from './boop-sfx-manifest';

let audioContext: AudioContext | null = null;
let loadPromise: Promise<AudioBuffer | null> | null = null;
let buffer: AudioBuffer | null = null;

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

async function loadUpgradeBuffer(): Promise<AudioBuffer | null> {
  if (buffer) return buffer;
  const ctx = ensureContext();
  if (!ctx) return null;
  const res = await fetch(BOOP_UPGRADE_SFX_URL);
  if (!res.ok) return null;
  const data = await res.arrayBuffer();
  buffer = await ctx.decodeAudioData(data.slice(0));
  return buffer;
}

/** Graduation sting (kitten → cat in hand); respects Sound toggle and audio unlock. */
export function playBoopUpgradeSound(): void {
  if (!isPlaceSoundEnabled() || typeof window === 'undefined') return;
  const run = async () => {
    loadPromise ??= loadUpgradeBuffer();
    const clip = await loadPromise;
    const ctx = ensureContext();
    if (!ctx || !clip) return;
    unlockAudioContext();
    if (ctx.state !== 'running') return;

    const source = ctx.createBufferSource();
    source.buffer = clip;
    const gain = ctx.createGain();
    gain.gain.value = 0.95 + Math.random() * 0.1;
    source.playbackRate.value = 0.98 + Math.random() * 0.04;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  };
  void run();
}
