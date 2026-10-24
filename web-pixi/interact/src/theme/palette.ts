import { BOARD_SLAB_THICKNESS_PITCH, LINE_W_PITCH } from "../tak-feel-constants.ts";

/** All draw surfaces read colors only from this shape (live theme swap). */
export interface InteractTheme {
  id: "light" | "dark";
  stageBg: number;
  boardFill: number;
  boardLine: number;
  /** Side A — first player (black stones in Abstract hub). */
  playerA: number;
  playerAInk: number;
  /** Side B — second player (white stones). */
  playerB: number;
  playerBInk: number;
  selection: number;
  win: number;
  hover: number;
  hudInk: number;
  boardSlabSide: { color: number; alpha: number };
  boardContactShadow: { color: number; alpha: number };
  pieceContactShadow: {
    tint: number;
    coreAlpha: number;
    midAlpha: number;
    restOpacity: number;
    liftOpacity: number;
    softScaleRest: number;
    softScaleLift: number;
  };
}

export const WIN_ACCENT = 0x3b82f6;

export const LIGHT_SOFT_THEME: InteractTheme = {
  id: "light",
  stageBg: 0xf3f1ec,
  boardFill: 0xe8e4dc,
  boardLine: 0x5c564c,
  playerA: 0x111111,
  playerAInk: 0x222222,
  playerB: 0xf5f5f5,
  playerBInk: 0x222222,
  selection: 0x808080,
  win: WIN_ACCENT,
  hover: 0x94a3b8,
  hudInk: 0x5c564c,
  boardSlabSide: { color: 0x5c564c, alpha: 0.08 },
  boardContactShadow: { color: 0x5c564c, alpha: 0.14 },
  pieceContactShadow: {
    tint: 0x1a1814,
    coreAlpha: 0.55,
    midAlpha: 0.25,
    restOpacity: 0.6,
    liftOpacity: 0.35,
    softScaleRest: 1.12,
    softScaleLift: 1.45,
  },
};

export const DARK_THEME: InteractTheme = {
  id: "dark",
  stageBg: 0x16171a,
  boardFill: 0x22242a,
  boardLine: 0x8a8f98,
  playerA: 0x111111,
  playerAInk: 0xd0d0d0,
  playerB: 0xf5f5f5,
  playerBInk: 0x222222,
  selection: 0x808080,
  win: WIN_ACCENT,
  hover: 0x94a3b8,
  hudInk: 0xc8ccd4,
  boardSlabSide: { color: 0x000000, alpha: 0.22 },
  boardContactShadow: { color: 0x000000, alpha: 0.42 },
  pieceContactShadow: {
    tint: 0x000000,
    coreAlpha: 0.72,
    midAlpha: 0.38,
    restOpacity: 0.75,
    liftOpacity: 0.5,
    softScaleRest: 1.28,
    softScaleLift: 1.55,
  },
};

export type ThemeId = InteractTheme["id"];

const STORAGE_KEY = "abstract-pixi-interact-theme";

export function themeById(id: ThemeId): InteractTheme {
  return id === "dark" ? DARK_THEME : LIGHT_SOFT_THEME;
}

export function systemPreferredThemeId(): ThemeId {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readStoredThemeId(): ThemeId | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* private mode */
  }
  return null;
}

export function resolveInitialThemeId(): ThemeId {
  return readStoredThemeId() ?? systemPreferredThemeId();
}

export function persistThemeId(id: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* optional */
  }
}

export type PlayerSide = "A" | "B";

export function themeFill(theme: InteractTheme, side: PlayerSide): number {
  return side === "A" ? theme.playerA : theme.playerB;
}

export function themeInk(theme: InteractTheme, side: PlayerSide): number {
  return side === "A" ? theme.playerAInk : theme.playerBInk;
}

export const CELL_PITCH = 1;

export function lineWidthPx(cellPitchPx: number): number {
  return Math.max(1, LINE_W_PITCH * cellPitchPx);
}

export function boardSlabPx(cellPitchPx: number): number {
  return BOARD_SLAB_THICKNESS_PITCH * cellPitchPx;
}

export const OBLIQUE_SIDE_FACTOR = 0.42;

export const TRAY_THEME = {
  gapFromBoardPitch: 0.35,
  slotPitch: 0.72,
  slotDepthPitch: 0.55,
  countFontSizePx: 11,
} as const;

/** @deprecated Use `LIGHT_SOFT_THEME` — hub soft palette, not strict Astra B&W. */
export const ASTRA_BW = {
  stageBg: LIGHT_SOFT_THEME.stageBg,
  boardFill: LIGHT_SOFT_THEME.boardFill,
  boardLine: LIGHT_SOFT_THEME.boardLine,
  playerA: LIGHT_SOFT_THEME.playerB,
  playerAInk: LIGHT_SOFT_THEME.playerBInk,
  playerB: LIGHT_SOFT_THEME.playerA,
  playerBInk: LIGHT_SOFT_THEME.playerAInk,
  selection: LIGHT_SOFT_THEME.selection,
  win: LIGHT_SOFT_THEME.win,
  hover: LIGHT_SOFT_THEME.hover,
} as const;

export type AstraColorSide = PlayerSide;

export function astraFill(side: AstraColorSide): number {
  return themeFill(LIGHT_SOFT_THEME, side);
}

export function astraInk(side: AstraColorSide): number {
  return themeInk(LIGHT_SOFT_THEME, side);
}
