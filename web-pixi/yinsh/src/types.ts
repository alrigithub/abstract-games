import type { Coord } from "./coords";

export type Player = "A" | "B";

export type MoveJson =
  | { type: "placeRing"; coord: Coord }
  | { type: "placeMarker"; coord: Coord }
  | { type: "moveRing"; start: Coord; end: Coord }
  | { type: "removeRun"; seed: Coord }
  | { type: "removeRing"; coord: Coord }
  | { type: "wait" };

export type TurnModeJson =
  | "RingPlacement"
  | "MarkerPlacement"
  | "WaitForMarkerPlacement"
  | { WaitForRingMovement: Coord }
  | { RingMovement: Coord }
  | { RunRemoval: Player }
  | { WaitForRunRemoval: Player }
  | { RingRemoval: Player }
  | { WaitForRingRemoval: Player };

export type BoardJson = {
  rings_a: Coord[];
  rings_b: Coord[];
  markers_a: Coord[];
  markers_b: Coord[];
};

export type RenderState = {
  active_player: Player;
  turn_mode: TurnModeJson;
  board: BoardJson;
  points_a: number;
  points_b: number;
  winner: Player | null;
  legal_moves: MoveJson[];
  human_turn: boolean;
  auto_wait: boolean;
};

export function turnModeLabel(tm: TurnModeJson): string {
  if (tm === "RingPlacement") return "Place a ring";
  if (tm === "MarkerPlacement") return "Place a marker in your ring";
  if (tm === "WaitForMarkerPlacement") return "…";
  if (typeof tm === "object" && "WaitForRingMovement" in tm)
    return "Click your ring to move it";
  if (typeof tm === "object" && "RingMovement" in tm) return "Move your ring";
  if (typeof tm === "object" && "RunRemoval" in tm) return "Remove a five";
  if (typeof tm === "object" && "RingRemoval" in tm) return "Remove one of your rings";
  return "…";
}
