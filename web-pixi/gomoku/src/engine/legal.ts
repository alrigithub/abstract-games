import { BOARD_SIZE, type Board, type Coord } from "./types";

export function isBoardFull(board: Board): boolean {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) return false;
    }
  }
  return true;
}

export function listLegalMoves(board: Board): Coord[] {
  const moves: Coord[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) moves.push({ x, y });
    }
  }
  return moves;
}
