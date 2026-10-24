import { theme } from "./theme";

/** Numeric palette for Pixi fills (alias of theme). */
export const palette = {
  playerA: theme.playerA,
  playerB: theme.playerB,
  playerBStroke: theme.playerBStroke,
  win: theme.win,
  boardFill: theme.boardFill,
  boardLine: theme.boardLine,
  stageBg: theme.stageBg,
  hover: theme.hover,
  selectionGlow: theme.selectionGlow,
} as const;
