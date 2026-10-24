import { Graphics } from "pixi.js";
import { theme } from "./theme";

export function drawHoverRing(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
) {
  g.circle(x, y, radius).stroke({
    width: 2,
    color: theme.hover,
    alpha: 0.85,
  });
}

export function drawLegalTarget(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
) {
  g.circle(x, y, radius).fill({ color: 0xffffff, alpha: 0.12 });
}

export function drawSelectionPulse(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  pulseT: number,
) {
  const amp = 0.08;
  const scale = 1 + amp * Math.sin(pulseT * 7 * Math.PI * 2);
  g.circle(x, y, radius * scale).stroke({
    width: 3,
    color: theme.hover,
    alpha: 0.9,
  });
}
