import { Graphics, Sprite, Texture } from "pixi.js";
import type { InteractTheme } from "../theme/palette.ts";

const blobCache = new Map<string, Texture>();

function shadowCacheKey(theme: InteractTheme): string {
  const p = theme.pieceContactShadow;
  return `${p.tint}-${p.coreAlpha}-${p.midAlpha}`;
}

/** Prerendered radial blob — tinted per theme. */
export function contactShadowTexture(theme: InteractTheme): Texture {
  const key = shadowCacheKey(theme);
  const cached = blobCache.get(key);
  if (cached) return cached;

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const p = theme.pieceContactShadow;
  const r = (p.tint >> 16) & 255;
  const g = (p.tint >> 8) & 255;
  const b = p.tint & 255;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},${p.coreAlpha})`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},${p.midAlpha})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = Texture.from(canvas);
  blobCache.set(key, tex);
  return tex;
}

export function makeContactShadow(theme: InteractTheme): Sprite {
  const s = new Sprite(contactShadowTexture(theme));
  s.anchor.set(0.5, 0.5);
  s.alpha = theme.pieceContactShadow.restOpacity;
  return s;
}

export function applyLiftShadow(
  shadow: Sprite,
  theme: InteractTheme,
  liftT: number,
  baseRadiusPx: number,
): void {
  const t = Math.max(0, Math.min(1, liftT));
  const p = theme.pieceContactShadow;
  const scale = p.softScaleRest + (p.softScaleLift - p.softScaleRest) * t;
  shadow.scale.set((baseRadiusPx * 2 * scale) / shadow.texture.width);
  shadow.alpha = p.restOpacity + (p.liftOpacity - p.restOpacity) * t;
  const baseY = shadow.position.y;
  shadow.x = t * baseRadiusPx * 0.12;
  shadow.y = baseY + t * baseRadiusPx * 0.08;
}

export function drawBoardShadow(
  g: Graphics,
  w: number,
  h: number,
  theme: InteractTheme,
): void {
  g.clear();
  const b = theme.boardContactShadow;
  g.ellipse(0, h * 0.08, w * 0.56, h * 0.08);
  g.fill({ color: b.color, alpha: b.alpha });
}
