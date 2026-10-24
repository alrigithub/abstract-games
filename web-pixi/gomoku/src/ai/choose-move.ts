import {
  BOARD_SIZE,
  listLegalMoves,
  opponent,
  place,
  type Board,
  type Coord,
  type Player,
} from "../engine";

function playingStatus(side: Player) {
  return { kind: "playing" as const, toMove: side };
}

function wouldWin(board: Board, side: Player, x: number, y: number): boolean {
  const result = place(board, playingStatus(side), x, y);
  return result.status.kind === "won" && result.status.winner === side;
}

function lineLengthIfPlace(
  board: Board,
  x: number,
  y: number,
  side: Player,
  dx: number,
  dy: number,
): number {
  const result = place(board, playingStatus(side), x, y);
  if (result.board === board) return 0;
  let total = 1;
  for (const [sx, sy] of [
    [dx, dy],
    [-dx, -dy],
  ] as const) {
    let cx = x + sx;
    let cy = y + sy;
    while (
      cx >= 0 &&
      cx < BOARD_SIZE &&
      cy >= 0 &&
      cy < BOARD_SIZE &&
      result.board[cy][cx] === side
    ) {
      total++;
      cx += sx;
      cy += sy;
    }
  }
  return total;
}

function heuristic(board: Board, side: Player, x: number, y: number): number {
  const axes: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  let score = 0;
  for (const [dx, dy] of axes) {
    const len = lineLengthIfPlace(board, x, y, side, dx, dy);
    if (len >= 5) score += 1_000_000;
    else if (len === 4) score += 50_000;
    else if (len === 3) score += 5_000;
    else if (len === 2) score += 500;
    else score += 10;
  }
  const center = (BOARD_SIZE - 1) / 2;
  const dist = Math.abs(x - center) + Math.abs(y - center);
  score += Math.max(0, 40 - dist * 2);
  return score;
}

export function chooseAiMove(
  board: Board,
  side: Player,
  random: () => number = Math.random,
): Coord {
  const legal = listLegalMoves(board);
  if (legal.length === 0) throw new Error("no legal moves");

  const winMove = legal.find((m) => wouldWin(board, side, m.x, m.y));
  if (winMove) return winMove;

  const opp = opponent(side);
  const blockMove = legal.find((m) => wouldWin(board, opp, m.x, m.y));
  if (blockMove) return blockMove;

  let bestScore = -Infinity;
  let best: Coord[] = [];
  for (const m of legal) {
    const s = heuristic(board, side, m.x, m.y);
    if (s > bestScore) {
      bestScore = s;
      best = [m];
    } else if (s === bestScore) {
      best.push(m);
    }
  }
  const idx = Math.min(best.length - 1, Math.floor(random() * best.length));
  return best[idx]!;
}
