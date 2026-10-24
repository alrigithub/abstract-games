/** Light board tokens aligned with `abstract_gui_theme::LIGHT` / Yinsh Pixi. */
export const theme = {
  stageBg: 0xf3f1ec,
  boardFill: 0xe8e4dc,
  boardLine: 0x5c564c,
  playerA: 0x111111,
  playerB: 0xf5f5f5,
  playerBStroke: 0x222222,
  win: 0x3b82f6,
  hover: 0x94a3b8,
  selectionGlow: 0x64748b,
  animMs: 500,
  scoreLingerMs: 850,
} as const;

export type PixiTheme = typeof theme;
