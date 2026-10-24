import { isPlaceSoundEnabled } from '@abstract/three-engine';
import { BOOP_UPGRADE_SFX_URL, BOOP_WIN_SFX_URL } from './boop-sfx-manifest';

const UPGRADE_OVERLAP_FADE_MS = 110;

let audioContext: AudioContext | null = null;
let loadPromise: Promise<AudioBuffer | null> | null = null;
let buffer: AudioBuffer | null = null;
let activeUpgrade: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

let winLoadPromise: Promise<AudioBuffer | null> | null = null;
let winBuffer: AudioBuffer | null = null;
let activeWin: AudioBufferSourceNode | null = null;

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

function fadeOutActiveUpgrade(): void {
  const ctx = audioContext;
  const active = activeUpgrade;
  if (!ctx || !active) return;
  activeUpgrade = null;
  const { source, gain } = active;
  const now = ctx.currentTime;
  const fadeSec = UPGRADE_OVERLAP_FADE_MS / 1000;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + fadeSec);
  try {
    source.stop(now + fadeSec + 0.02);
  } catch {
    /* already stopped */
  }
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

async function loadWinBuffer(): Promise<AudioBuffer | null> {
  if (winBuffer) return winBuffer;
  const ctx = ensureContext();
  if (!ctx) return null;
  const res = await fetch(BOOP_WIN_SFX_URL);
  if (!res.ok) return null;
  const data = await res.arrayBuffer();
  winBuffer = await ctx.decodeAudioData(data.slice(0));
  return winBuffer;
}

/** Stop the win celebration track (e.g. new game). */
export function stopBoopWinSound(): void {
  const source = activeWin;
  activeWin = null;
  if (!source) return;
  try {
    source.stop();
  } catch {
    /* already stopped */
  }
}

/** Win jingle; plays once per game-over win while Sound is on. */
export function playBoopWinSound(): void {
  if (!isPlaceSoundEnabled() || typeof window === 'undefined') return;
  const run = async () => {
    winLoadPromise ??= loadWinBuffer();
    const clip = await winLoadPromise;
    const ctx = ensureContext();
    if (!ctx || !clip) return;
    unlockAudioContext();
    if (ctx.state !== 'running') return;

    stopBoopWinSound();

    const source = ctx.createBufferSource();
    source.buffer = clip;
    const gain = ctx.createGain();
    gain.gain.value = 0.92;
    source.connect(gain);
    gain.connect(ctx.destination);
    activeWin = source;
    source.onended = () => {
      if (activeWin === source) activeWin = null;
    };
    source.start(0);
  };
  void run();
}

/** Graduation ding (kitten vanish); respects Sound toggle and audio unlock. Retriggers per piece. */
export function playBoopUpgradeSound(): void {
  if (!isPlaceSoundEnabled() || typeof window === 'undefined') return;
  const run = async () => {
    loadPromise ??= loadUpgradeBuffer();
    const clip = await loadPromise;
    const ctx = ensureContext();
    if (!ctx || !clip) return;
    unlockAudioContext();
    if (ctx.state !== 'running') return;

    fadeOutActiveUpgrade();

    const source = ctx.createBufferSource();
    source.buffer = clip;
    const gain = ctx.createGain();
    gain.gain.value = 0.95 + Math.random() * 0.1;
    source.playbackRate.value = 0.98 + Math.random() * 0.04;
    source.connect(gain);
    gain.connect(ctx.destination);
    activeUpgrade = { source, gain };
    source.onended = () => {
      if (activeUpgrade?.source === source) activeUpgrade = null;
    };
    source.start(0);
  };
  void run();
}
