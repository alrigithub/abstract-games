import {
  legalMoves,
  step,
  type Direction,
  type GameState,
  type Move,
} from "./engine";

export function directionBetween(
  from: number,
  to: number,
  size: number,
): Direction | null {
  const fr = Math.floor(from / size);
  const fc = from % size;
  const tr = Math.floor(to / size);
  const tc = to % size;
  if (tr === fr - 1 && tc === fc) return "north";
  if (tr === fr + 1 && tc === fc) return "south";
  if (tr === fr && tc === fc + 1) return "east";
  if (tr === fr && tc === fc - 1) return "west";
  return null;
}

function spreadDestination(
  from: number,
  direction: Direction,
  drops: number[],
  size: number,
): number {
  let target = from;
  for (let i = 0; i < drops.length; i++) {
    target = step(size, target, direction)!;
  }
  return target;
}

function spreadDropCells(
  from: number,
  direction: Direction,
  drops: number[],
  size: number,
): number[] {
  const cells: number[] = [];
  let target = from;
  for (const _drop of drops) {
    target = step(size, target, direction)!;
    cells.push(target);
  }
  return cells;
}

function spreadTouches(
  move: Move,
  from: number,
  to: number,
  size: number,
): boolean {
  if (move.type !== "spread") return false;
  const dest = spreadDestination(from, move.direction, move.drops, size);
  if (dest === to) return true;
  return spreadDropCells(from, move.direction, move.drops, size).includes(to);
}

/** Pick the legal spread that matches a from→to click (Bevy `slide_to` parity). */
export function slideTo(
  game: GameState,
  from: number,
  to: number,
): Move | null {
  if (from === to) return null;
  const size = game.board.size;
  const matches = legalMoves(game).filter(
    (m) =>
      m.type === "spread" &&
      m.from === from &&
      spreadTouches(m, from, to, size),
  );
  if (!matches.length) return null;
  matches.sort((a, b) => {
    if (a.type !== "spread" || b.type !== "spread") return 0;
    const aDest = spreadDestination(from, a.direction, a.drops, size);
    const bDest = spreadDestination(from, b.direction, b.drops, size);
    const aPri = aDest === to ? 0 : 1;
    const bPri = bDest === to ? 0 : 1;
    return aPri - bPri;
  });
  return matches[0] ?? null;
}

/** Cells visited by a spread preview (including drop cells). */
export function spreadPreviewCells(
  from: number,
  direction: Direction,
  drops: number[],
  size: number,
): number[] {
  return spreadDropCells(from, direction, drops, size);
}
