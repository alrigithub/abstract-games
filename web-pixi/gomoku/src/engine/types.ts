export const BOARD_SIZE = 15 as const;

export type Player = "black" | "white";
export type Cell = Player | null;
export type Board = Cell[][];
export type Coord = { x: number; y: number };

export type GameStatus =
  | { kind: "playing"; toMove: Player }
  | { kind: "won"; winner: Player }
  | { kind: "draw" };
