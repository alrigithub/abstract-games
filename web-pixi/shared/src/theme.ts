import { PIXI_PALETTE } from "./pixi-stage/palette";

export { PIXI_PALETTE };

/** Yinsh/Tzaar animation + piece tokens on top of shared palette. */
export const theme = {
  ...PIXI_PALETTE,
  ringInner: 20,
  ringOuter: 25,
  markerRadius: 16,
  animMs: 500,
  scoreLingerMs: 850,
  dustLifetimeMs: 750,
} as const;

export const AI_STRENGTH_MIN = 1;
export const AI_STRENGTH_MAX = 24;
export const DEFAULT_AI_STRENGTH = 10;
