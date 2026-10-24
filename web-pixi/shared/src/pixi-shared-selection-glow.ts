import { Graphics } from "pixi.js";
import { PIXI_PALETTE } from "./pixi-stage/palette";

export function drawHoverRing(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
): void {
  g.circle(x, y, radius).stroke({
    width: 2,
    color: PIXI_PALETTE.hover,
    alpha: 0.85,
  });
}

export function drawSelectionPulse(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  pulseT: number,
): void {
  const amp = 0.08 + 0.06 * Math.sin(pulseT * 7 * Math.PI * 2);
  const r = radius * (1 + amp);
  g.circle(x, y, r).stroke({
    width: 3,
    color: PIXI_PALETTE.hover,
    alpha: 0.75 + 0.2 * Math.sin(pulseT * 9 * Math.PI * 2),
  });
}
