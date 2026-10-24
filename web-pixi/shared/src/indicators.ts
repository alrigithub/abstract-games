import { Graphics } from "pixi.js";
import { theme } from "./theme";

export function drawHoverRing(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  color: number = theme.hover,
) {
  g.circle(x, y, radius).stroke({
    width: 2,
    color,
    alpha: 0.85,
  });
}

/** Soft pulsing selection halo (call each frame with elapsed seconds). */
export function drawSelectionPulse(
  g: Graphics,
  x: number,
  y: number,
  baseRadius: number,
  tSec: number,
  color: number = theme.hover,
) {
  const pulse = 1 + 0.08 * Math.sin(tSec * 7 * Math.PI * 2);
  g.circle(x, y, baseRadius * pulse).stroke({
    width: 2.5,
    color,
    alpha: 0.75,
  });
}
