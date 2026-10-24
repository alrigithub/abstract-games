import { cloneBoard } from "./board";
import { isBoardFull } from "./legal";
import {
  BOARD_SIZE,
  type Board,
  type Coord,
  type GameStatus,
  type Player,
} from "./types";

export function opponent(player: Player): Player {
  return player === "black" ? "white" : "black";
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

export function countLine(
  board: Board,
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: Player,
): number {
  let n = 0;
  let cx = x;
  let cy = y;
  while (inBounds(cx, cy) && board[cy][cx] === player) {
    n++;
    cx += dx;
    cy += dy;
  }
  return n;
}

export function winsAt(
  board: Board,
  x: number,
  y: number,
  player: Player,
): boolean {
  if (!inBounds(x, y) || board[y][x] !== player) return false;
  const axes: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (const [dx, dy] of axes) {
    const total =
      countLine(board, x, y, dx, dy, player) +
      countLine(board, x, y, -dx, -dy, player) -
      1;
    if (total >= 5) return true;
  }
  return false;
}

export function findWinningLine(
  board: Board,
  x: number,
  y: number,
  player: Player,
): Coord[] | null {
  if (!inBounds(x, y) || board[y][x] !== player) return null;
  const axes: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (const [dx, dy] of axes) {
    const cells: Coord[] = [{ x, y }];
    for (const dir of [1, -1] as const) {
      let cx = x + dx * dir;
      let cy = y + dy * dir;
      while (inBounds(cx, cy) && board[cy][cx] === player) {
        cells.push({ x: cx, y: cy });
        cx += dx * dir;
        cy += dy * dir;
      }
    }
    if (cells.length >= 5) {
      cells.sort((a, b) => a.y - b.y || a.x - b.x);
      return cells.slice(0, 5);
    }
  }
  return null;
}

export function place(
  board: Board,
  status: GameStatus,
  x: number,
  y: number,
): { board: Board; status: GameStatus } {
  if (status.kind !== "playing") return { board, status };
  if (!inBounds(x, y)) return { board, status };
  if (board[y][x] !== null) return { board, status };

  const nextBoard = cloneBoard(board);
  const player = status.toMove;
  nextBoard[y][x] = player;

  if (winsAt(nextBoard, x, y, player)) {
    return { board: nextBoard, status: { kind: "won", winner: player } };
  }

  if (isBoardFull(nextBoard)) {
    return { board: nextBoard, status: { kind: "draw" } };
  }

  return {
    board: nextBoard,
    status: { kind: "playing", toMove: opponent(player) },
  };
}
