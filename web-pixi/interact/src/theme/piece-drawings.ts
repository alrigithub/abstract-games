/**
 * 2D slight-oblique piece art (1 unit = cell pitch).
 * Tak boxes: IMPLEMENTED.md restore section (approved `tak-bw.png`).
 * Gomoku lens + Boop crown: `astra-pieces.md` / `astra-boop-cats.md`.
 */

import { Graphics } from "pixi.js";
import type { InteractTheme, PlayerSide } from "./palette.ts";
import { OBLIQUE_SIDE_FACTOR, themeFill, themeInk } from "./palette.ts";

export type AstraColorSide = PlayerSide;

export type TakVariant = "flat" | "wall" | "capstone";
export type DemoPieceKind =
  | { game: "tak"; variant: TakVariant }
  | { game: "gomoku" }
  | { game: "boop"; kitten?: boolean };

const TAK_FLAT_H = 0.18;
const TAK_FLAT_FOOT = 0.68;
const TAK_WALL_H = 0.68;
const TAK_WALL_THICK = 0.18;
const TAK_CAP_H = 0.78;
const TAK_CAP_BASE = 0.56;
const TAK_CAP_TOP = 0.28;

/** Draw into `g` centered at (0,0), scale = cell pitch in px. */
export function drawPiece(
  g: Graphics,
  kind: DemoPieceKind,
  side: PlayerSide,
  scale: number,
  theme: InteractTheme,
): void {
  const fill = themeFill(theme, side);
  const ink = themeInk(theme, side);
  g.clear();
  if (kind.game === "tak") {
    drawTak(g, kind.variant, fill, ink, scale);
  } else if (kind.game === "gomoku") {
    drawGomokuLens(g, fill, ink, scale);
  } else {
    drawBoopCrown(g, fill, ink, scale, kind.kitten ?? false);
  }
}

function drawTak(
  g: Graphics,
  variant: TakVariant,
  fill: number,
  ink: number,
  pitch: number,
): void {
  const side = OBLIQUE_SIDE_FACTOR * pitch;
  if (variant === "flat") {
    const w = TAK_FLAT_FOOT * pitch;
    const h = TAK_FLAT_H * pitch;
    const topY = -h - side * 0.35;
    g.roundRect(-w / 2, topY, w, h, 1);
    g.fill(fill);
    g.stroke({ width: 1, color: ink, alpha: 1 });
    // side face
    g.moveTo(-w / 2, topY + h);
    g.lineTo(-w / 2 + side, topY + h + side * 0.5);
    g.lineTo(w / 2 + side, topY + h + side * 0.5);
    g.lineTo(w / 2, topY + h);
    g.stroke({ width: 1, color: ink });
    g.moveTo(-w / 2, topY);
    g.lineTo(-w / 2 + side, topY + side * 0.5);
    g.stroke({ width: 1, color: ink });
    g.moveTo(w / 2, topY);
    g.lineTo(w / 2 + side, topY + side * 0.5);
    g.stroke({ width: 1, color: ink });
  } else if (variant === "wall") {
    const w = TAK_WALL_THICK * pitch;
    const h = TAK_WALL_H * pitch;
    const topY = -h - side * 0.2;
    g.roundRect(-w / 2, topY, w, h, 1);
    g.fill(fill);
    g.stroke({ width: 1, color: ink });
    g.moveTo(-w / 2, topY + h);
    g.lineTo(-w / 2 + side * 0.6, topY + h + side * 0.35);
    g.lineTo(w / 2 + side * 0.6, topY + h + side * 0.35);
    g.lineTo(w / 2, topY + h);
    g.stroke({ width: 1, color: ink });
  } else {
    const bh = TAK_CAP_H * pitch;
    const bw = TAK_CAP_BASE * pitch;
    const tw = TAK_CAP_TOP * pitch;
    const topY = -bh - side * 0.25;
    const baseY = topY + bh;
    g.moveTo(-bw / 2, baseY);
    g.lineTo(-tw / 2, topY);
    g.lineTo(tw / 2, topY);
    g.lineTo(bw / 2, baseY);
    g.closePath();
    g.fill(fill);
    g.stroke({ width: 1, color: ink });
    g.moveTo(-bw / 2, baseY);
    g.lineTo(-bw / 2 + side, baseY + side * 0.45);
    g.lineTo(bw / 2 + side, baseY + side * 0.45);
    g.lineTo(bw / 2, baseY);
    g.stroke({ width: 1, color: ink });
  }
}

/** Gomoku lens — lathe profile from astra-pieces.md. */
function drawGomokuLens(g: Graphics, fill: number, ink: number, pitch: number): void {
  const rx = 0.38 * pitch;
  const h = 0.2 * pitch;
  const side = OBLIQUE_SIDE_FACTOR * pitch * 0.35;
  const topY = -h - side;
  g.ellipse(0, topY + h * 0.35, rx, h * 0.55);
  g.fill(fill);
  g.stroke({ width: 1, color: ink });
  g.moveTo(-rx, topY + h * 0.55);
  g.quadraticCurveTo(-rx, topY + h + side * 0.2, 0, topY + h + side * 0.35);
  g.quadraticCurveTo(rx, topY + h + side * 0.2, rx, topY + h * 0.55);
  g.stroke({ width: 1, color: ink, alpha: side > 0 ? 1 : 0 });
  g.ellipse(0, topY + h * 0.92, rx * 0.85, h * 0.12);
  g.stroke({ width: 1, color: ink, alpha: 0.85 });
}

/** Boop beveled crown — profile from astra-boop-cats.md. */
function drawBoopCrown(
  g: Graphics,
  fill: number,
  ink: number,
  pitch: number,
  kitten: boolean,
): void {
  const s = kitten ? 0.75 : 1;
  const pts: [number, number][] = [
    [0, 0],
    [0.28, 0],
    [0.34, 0.18],
    [0.27, 0.28],
    [0, 0.28],
  ].map(([r, y]) => [r * pitch * s, -y * pitch * s - OBLIQUE_SIDE_FACTOR * pitch * 0.15]);
  g.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]![0], pts[i]![1]);
  g.lineTo(-pts[1]![0], pts[1]![1]);
  for (let i = 2; i < pts.length; i++) g.lineTo(-pts[i]![0], pts[i]![1]);
  g.closePath();
  g.fill(fill);
  g.stroke({ width: 1, color: ink });
  for (const y of [0, 0.18, 0.28]) {
    const yy = -y * pitch * s - OBLIQUE_SIDE_FACTOR * pitch * 0.15;
    const r = y === 0 ? 0.28 : y === 0.18 ? 0.34 : 0.27;
    g.ellipse(0, yy, r * pitch * s, 0.035 * pitch * s);
    g.stroke({ width: 1, color: ink, alpha: 0.9 });
  }
}

export function pieceStackOffsetPitch(kind: DemoPieceKind): number {
  if (kind.game === "tak") {
    if (kind.variant === "flat") return TAK_FLAT_H;
    if (kind.variant === "wall") return TAK_WALL_H;
    return TAK_CAP_H;
  }
  if (kind.game === "gomoku") return 0.2;
  return (kind.kitten ? 0.75 : 1) * 0.28;
}
