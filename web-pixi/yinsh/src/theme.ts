/** Matches `abstract_gui_theme::LIGHT` tokens. */
export const theme = {
  stageBg: 0xf3f1ec,
  boardFill: 0xe8e4dc,
  boardLine: 0x5c564c,
  playerA: 0x111111,
  playerB: 0xf5f5f5,
  playerBStroke: 0x222222,
  win: 0x3b82f6,
  hover: 0x94a3b8,
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
