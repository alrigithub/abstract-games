import {
  pixiTheme,
  AI_STRENGTH_MAX,
  AI_STRENGTH_MIN,
  DEFAULT_AI_STRENGTH,
} from "@abstract/pixi-shared";

export { AI_STRENGTH_MAX, AI_STRENGTH_MIN, DEFAULT_AI_STRENGTH };

/** Yinsh-specific radii on top of shared light theme. */
export const theme = {
  ...pixiTheme,
  ringInner: 20,
  ringOuter: 25,
  markerRadius: 16,
} as const;
