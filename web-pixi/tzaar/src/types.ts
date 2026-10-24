import type { Coord } from "./coords";

export type Player = "First" | "Second";
export type PieceKind = "Tzaar" | "Tzarra" | "Tott";
export type TurnPhase = "WhiteOpening" | "ForcedCapture" | "OptionalSecond";

export type PieceJson = {
  player: Player;
  kind: PieceKind;
};

export type StackJson = {
  pieces: PieceJson[];
};

export type BoardJson = {
  stacks: (StackJson | null)[];
};

export type MoveJson =
  | { type: "action"; from: Coord; to: Coord }
  | { type: "passSecond" };

export type RenderState = {
  board: BoardJson;
  to_move: Player;
  phase: TurnPhase;
  winner: Player | null;
  legal_moves: MoveJson[];
  human_turn: boolean;
  can_pass: boolean;
};

export const PIECE_LABEL: Record<PieceKind, string> = {
  Tzaar: "Tzaar",
  Tzarra: "Tzarra",
  Tott: "Tott",
};

export function playerLabel(p: Player): string {
  return p === "First" ? "White" : "Black";
}
