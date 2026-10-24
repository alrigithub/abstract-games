import {
  BOARD_SIZE,
  type Board,
  type GameStatus,
} from "./types";

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

export function createInitialStatus(): GameStatus {
  return { kind: "playing", toMove: "black" };
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}
