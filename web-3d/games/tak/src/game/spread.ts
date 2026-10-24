import { legalMoves, step, type Direction, type GameState, type Move } from './engine';

function directionBetween(size: number, from: number, to: number): Direction | null {
  const fr = Math.floor(from / size);
  const fc = from % size;
  const tr = Math.floor(to / size);
  const tc = to % size;
  const dr = tr - fr;
  const dc = tc - fc;
  if (dr === 0 && dc > 0) return 'east';
  if (dr === 0 && dc < 0) return 'west';
  if (dc === 0 && dr > 0) return 'south';
  if (dc === 0 && dr < 0) return 'north';
  return null;
}

function spreadDestination(size: number, from: number, direction: Direction, drops: number[]): number {
  let target = from;
  for (const _ of drops) target = step(size, target, direction)!;
  return target;
}

function spreadTouches(size: number, from: number, direction: Direction, drops: number[], to: number): boolean {
  if (spreadDestination(size, from, direction, drops) === to) return true;
  let cell = from;
  for (const _ of drops) {
    cell = step(size, cell, direction)!;
    if (cell === to) return true;
  }
  return false;
}

/** Pick the legal spread that matches a drag from `from` onto `to` with `pickup` pieces carried. */
export function spreadToMove(game: GameState, from: number, to: number, pickup: number): Move | null {
  const size = game.board.size;
  const direction = directionBetween(size, from, to);
  if (direction === null || from === to) return null;

  const candidates = legalMoves(game).filter(
    (move): move is Extract<Move, { type: 'spread' }> =>
      move.type === 'spread' &&
      move.from === from &&
      move.direction === direction &&
      move.drops.reduce((sum, drop) => sum + drop, 0) === pickup &&
      spreadTouches(size, from, direction, move.drops, to),
  );
  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const destA = spreadDestination(size, from, direction, a.drops);
    const destB = spreadDestination(size, from, direction, b.drops);
    const priA = destA === to ? 0 : 1;
    const priB = destB === to ? 0 : 1;
    return priA - priB || a.drops.length - b.drops.length;
  });
  return candidates[0] ?? null;
}

export function isLegalSpreadTarget(game: GameState, from: number, to: number, pickup: number): boolean {
  return spreadToMove(game, from, to, pickup) !== null;
}
