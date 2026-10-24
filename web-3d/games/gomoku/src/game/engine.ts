export const BOARD_SIZE = 15;

export type Player = 'black' | 'white';
export type Coord = { x: number; y: number };
export type Move = { type: 'place'; coord: Coord };

export interface GameState {
  cells: (Player | null)[];
  toMove: Player;
  winner: Player | null;
  lastMove: Coord | null;
  moveCount: number;
}

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export function coordIndex(coord: Coord): number {
  return coord.y * BOARD_SIZE + coord.x;
}

export function indexCoord(index: number): Coord {
  return { x: index % BOARD_SIZE, y: Math.floor(index / BOARD_SIZE) };
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

export function createGame(): GameState {
  return {
    cells: Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null),
    toMove: 'black',
    winner: null,
    lastMove: null,
    moveCount: 0,
  };
}

export function opponent(player: Player): Player {
  return player === 'black' ? 'white' : 'black';
}

export function getCell(state: GameState, coord: Coord): Player | null {
  if (!inBounds(coord.x, coord.y)) return null;
  return state.cells[coordIndex(coord)] ?? null;
}

function countAlong(state: GameState, start: Coord, player: Player, dx: number, dy: number): number {
  let count = 0;
  let x = start.x + dx;
  let y = start.y + dy;
  while (inBounds(x, y) && state.cells[y * BOARD_SIZE + x] === player) {
    count++;
    x += dx;
    y += dy;
  }
  return count;
}

export function winnerFromLastMove(state: GameState, coord: Coord): Player | null {
  const player = getCell(state, coord);
  if (!player) return null;
  for (const [dx, dy] of DIRECTIONS) {
    const count = 1 + countAlong(state, coord, player, dx, dy) + countAlong(state, coord, player, -dx, -dy);
    if (count >= 5) return player;
  }
  return null;
}

/** Coordinates of the winning run through `coord` (five or more). */
export function winningLine(state: GameState, coord: Coord): Coord[] | null {
  const player = getCell(state, coord);
  if (!player) return null;
  for (const [dx, dy] of DIRECTIONS) {
    const count = 1 + countAlong(state, coord, player, dx, dy) + countAlong(state, coord, player, -dx, -dy);
    if (count >= 5) {
      const line: Coord[] = [];
      let x = coord.x - countAlong(state, coord, player, -dx, -dy) * dx;
      let y = coord.y - countAlong(state, coord, player, -dx, -dy) * dy;
      for (let i = 0; i < count; i++) {
        line.push({ x, y });
        x += dx;
        y += dy;
      }
      return line;
    }
  }
  return null;
}

export function isFull(state: GameState): boolean {
  return state.cells.every(c => c !== null);
}

export function legalMoves(state: GameState): Move[] {
  if (state.winner || isFull(state)) return [];
  const moves: Move[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (state.cells[y * BOARD_SIZE + x] === null) moves.push({ type: 'place', coord: { x, y } });
    }
  }
  return moves;
}

export function applyMove(state: GameState, move: Move): GameState {
  if (state.winner) throw new Error('Game finished');
  const { coord } = move;
  if (!inBounds(coord.x, coord.y) || getCell(state, coord)) throw new Error('Illegal move');
  const cells = state.cells.slice();
  const player = state.toMove;
  cells[coordIndex(coord)] = player;
  const next: GameState = {
    cells,
    toMove: player,
    winner: null,
    lastMove: coord,
    moveCount: state.moveCount + 1,
  };
  const winner = winnerFromLastMove(next, coord);
  if (winner) {
    next.winner = winner;
  } else if (isFull(next)) {
    /* draw */
  } else {
    next.toMove = opponent(player);
  }
  return next;
}
