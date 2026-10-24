import type { DemoPieceKind } from "./theme/piece-drawings.ts";

export type PlayerSide = "A" | "B";

export interface PieceInstance {
  id: string;
  side: PlayerSide;
  kind: DemoPieceKind;
}

export type PickSource =
  | { type: "cell"; index: number }
  | { type: "tray"; side: PlayerSide; slot: number };

export interface Selection {
  source: PickSource;
  count: number;
}

export interface InteractHooks {
  getCells(): string[][];
  getTray(side: PlayerSide): number;
  /** Legal cell indices for the current selection (rules live in the game). */
  legalTargets(selection: Selection): readonly number[];
  canPick(source: PickSource): boolean;
  /** Apply committed move; return false to bounce. */
  onCommit(selection: Selection, target: number): boolean;
  onSelectionChange?(selection: Selection | null): void;
}

export interface Point {
  x: number;
  y: number;
}

export interface InteractionView {
  selection: Selection | null;
  dragging: boolean;
  pointer: Point | null;
  hoverCell: number | null;
  progress: number;
}
