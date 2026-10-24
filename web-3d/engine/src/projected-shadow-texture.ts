import * as THREE from 'three';
import type { AssistFootprint } from './types';

const TEXTURE_SIZE = 256;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Alpha 0–1 for a soft disc (darker core, blurred edge). */
export function discShadowAlpha(normalizedRadius: number): number {
  const edgeFade = smoothstep(1.02, 0.72, normalizedRadius);
  const core = Math.exp(-normalizedRadius * normalizedRadius * 1.35);
  return Math.min(1, edgeFade * (0.35 + 0.65 * core));
}

/** Alpha 0–1 for a soft ring footprint; `r` and `inner` are in outer-radius units. */
export function ringShadowAlpha(r: number, inner: number): number {
  const fade = 0.11;
  if (r > 1 + fade || r < inner - fade) return 0;
  const outerFade = 1 - smoothstep(1 - fade, 1 + fade, r);
  const innerFade = smoothstep(inner - fade, inner + fade, r);
  const band = outerFade * innerFade;
  if (band <= 0) return 0;
  const mid = (inner + 1) * 0.5;
  const half = Math.max(0.08, (1 - inner) * 0.5);
  const along = 1 - Math.min(1, Math.abs(r - mid) / half);
  return band * (0.55 + 0.45 * along);
}

function footprintTextureKey(footprint: AssistFootprint): string {
  const inner = footprint.innerRadius ?? footprint.outerRadius * 0.72;
  return `${footprint.shape}:${footprint.outerRadius.toFixed(4)}:${inner.toFixed(4)}`;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Canvas alpha map for a blurred piece projection (ring or disc).
 * Returns null in non-DOM environments (tests use solid fallback).
 */
export function getProjectedShadowTexture(footprint: AssistFootprint): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const key = footprintTextureKey(footprint);
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const cx = TEXTURE_SIZE / 2;
  const cy = TEXTURE_SIZE / 2;
  const outer = footprint.outerRadius;
  const inner =
    footprint.shape === 'ring'
      ? (footprint.innerRadius ?? footprint.outerRadius * 0.72) / outer
      : 0;

  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const r = Math.hypot(dx, dy);
      const alpha =
        footprint.shape === 'ring' ? ringShadowAlpha(r, inner) : discShadowAlpha(r);
      const i = (y * TEXTURE_SIZE + x) * 4;
      const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
      image.data[i] = 255;
      image.data[i + 1] = 255;
      image.data[i + 2] = 255;
      image.data[i + 3] = a;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

export function disposeProjectedShadowTextures(): void {
  for (const tex of textureCache.values()) tex.dispose();
  textureCache.clear();
}
