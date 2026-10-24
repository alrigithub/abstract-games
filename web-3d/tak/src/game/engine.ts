import { createSandboxState } from '../state';
import type { BoardState, Color, Orientation, Piece, PieceKind } from '../types';

export type Direction = 'north' | 'east' | 'south' | 'west';
export type Move = { type: 'place'; to: number; kind: PieceKind; orientation: Orientation } | { type: 'spread'; from: number; direction: Direction; drops: number[] };
export interface GameResult { winner: Color | null; reason: 'road' | 'flats'; flats: Record<Color, number> }
export interface GameState { board: BoardState; toMove: Color; ply: number; result: GameResult | null }
export const opposite = (color: Color): Color => color === 'ivory' ? 'charcoal' : 'ivory';
export const placementColor = (game: GameState): Color => game.ply < 2 ? opposite(game.toMove) : game.toMove;
export function createGame(size = 5): GameState {
  if (![3, 4, 5, 6, 8].includes(size)) throw new RangeError('Official Tak boards are 3, 4, 5, 6, or 8');
  return { board: createSandboxState(size), toMove: 'ivory', ply: 0, result: null };
}
export function reservePieces(game: GameState, color: Color, kind?: PieceKind): Piece[] {
  return game.board.cells.slice(game.board.size ** 2).flat().filter(piece => piece.color === color && (!kind || piece.kind === kind));
}

export function ownedFromTop(cells: Piece[], color: Color): number {
  let count = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i]!.color !== color) break;
    count++;
  }
  return count;
}

export function carryLimit(size: number): number {
  return size;
}

function flatScoringTriggered(game: GameState): boolean {
  const playable = game.board.size ** 2;
  if (game.board.cells.slice(0, playable).every(stack => stack.length)) return true;
  return reservePieces(game, 'ivory', 'stone').length === 0 || reservePieces(game, 'charcoal', 'stone').length === 0;
}
export function step(size: number, cell: number, direction: Direction): number | null {
  const row = Math.floor(cell / size), col = cell % size;
  const [dr, dc] = ({ north: [-1, 0], east: [0, 1], south: [1, 0], west: [0, -1] } as const)[direction] ?? [NaN, NaN];
  const r = row + dr, c = col + dc;
  return r >= 0 && c >= 0 && r < size && c < size ? r * size + c : null;
}
export function isLegalMove(game: GameState, move: Move): boolean {
  if (game.result || !move || typeof move !== 'object') return false;
  const { size, cells } = game.board;
  const onBoard = (cell: number) => Number.isInteger(cell) && cell >= 0 && cell < size ** 2;
  if (move.type === 'place') return onBoard(move.to) && !cells[move.to]!.length &&
    (move.kind === 'stone' || move.kind === 'capstone') && (move.orientation === 'flat' || move.orientation === 'standing') &&
    (move.kind !== 'capstone' || move.orientation === 'flat') &&
    (game.ply >= 2 || (move.kind === 'stone' && move.orientation === 'flat')) && reservePieces(game, placementColor(game), move.kind).length > 0;
  if (move.type !== 'spread' || game.ply < 2 || !onBoard(move.from) || !Array.isArray(move.drops) || !move.drops.length || move.drops.length > carryLimit(size) || move.drops.some(n => !Number.isInteger(n) || n <= 0)) return false;
  const stack = cells[move.from]!, top = stack.at(-1), count = move.drops.reduce((a, b) => a + b, 0);
  const owned = ownedFromTop(stack, game.toMove);
  if (!top || top.color !== game.toMove || count > carryLimit(size) || count > owned) return false;
  let target = move.from, remaining = count;
  for (const drop of move.drops) {
    const next = step(size, target, move.direction);
    if (next === null) return false;
    target = next;
    const obstacle = cells[target]!.at(-1);
    if (obstacle?.kind === 'capstone') return false;
    if (obstacle?.orientation === 'standing' && !(top.kind === 'capstone' && remaining === 1 && drop === 1)) return false;
    remaining -= drop;
  }
  return true;
}
export function hasRoad(board: BoardState, color: Color): boolean {
  const { size, cells } = board;
  const road = (cell: number) => { const top = cells[cell]!.at(-1); return top?.color === color && (top.kind === 'capstone' || top.orientation === 'flat'); };
  for (const vertical of [true, false]) {
    const todo: number[] = [], seen = new Set<number>();
    for (let i = 0; i < size; i++) { const cell = vertical ? i : i * size; if (road(cell)) { todo.push(cell); seen.add(cell); } }
    while (todo.length) {
      const cell = todo.pop()!;
      if (vertical ? Math.floor(cell / size) === size - 1 : cell % size === size - 1) return true;
      for (const dir of ['north', 'east', 'south', 'west'] as const) { const next = step(size, cell, dir); if (next !== null && !seen.has(next) && road(next)) { seen.add(next); todo.push(next); } }
    }
  }
  return false;
}
export function flatCounts(board: BoardState): Record<Color, number> {
  const counts = { ivory: 0, charcoal: 0 };
  for (const stack of board.cells.slice(0, board.size ** 2)) { const top = stack.at(-1); if (top?.kind === 'stone' && top.orientation === 'flat') counts[top.color]++; }
  return counts;
}
export function adjudicate(game: GameState, mover: Color): GameResult | null {
  const flats = flatCounts(game.board);
  for (const color of [mover, opposite(mover)]) if (hasRoad(game.board, color)) return { winner: color, reason: 'road', flats };
  if (flatScoringTriggered(game))
    return { winner: flats.ivory === flats.charcoal ? null : flats.ivory > flats.charcoal ? 'ivory' : 'charcoal', reason: 'flats', flats };
  return null;
}
/** Pure transition. Every physical piece keeps its identity, including reserve pieces. */
export function applyMove(game: GameState, move: Move): GameState {
  if (!isLegalMove(game, move)) throw new Error('Illegal Tak move');
  const cells = game.board.cells.slice();
  if (move.type === 'place') {
    const color = placementColor(game);
    const source = cells.findIndex((stack, index) => index >= game.board.size ** 2 && stack.some(piece => piece.color === color && piece.kind === move.kind));
    let offset = cells[source]!.length - 1;
    while (cells[source]![offset]!.color !== color || cells[source]![offset]!.kind !== move.kind) offset--;
    const piece = cells[source]![offset]!;
    cells[source] = cells[source]!.filter((_, i) => i !== offset);
    cells[move.to] = [{ ...piece, orientation: move.orientation }];
  } else {
    const count = move.drops.reduce((a, b) => a + b, 0), stack = cells[move.from]!, carried = stack.slice(-count);
    cells[move.from] = stack.slice(0, -count);
    let target = move.from, offset = 0;
    for (const drop of move.drops) {
      target = step(game.board.size, target, move.direction)!;
      const destination = cells[target]!, top = destination.at(-1);
      const flattened = top?.orientation === 'standing' ? [...destination.slice(0, -1), { ...top, orientation: 'flat' as const }] : destination;
      cells[target] = [...flattened, ...carried.slice(offset, offset + drop)]; offset += drop;
    }
  }
  const next: GameState = { board: { ...game.board, cells }, toMove: opposite(game.toMove), ply: game.ply + 1, result: null };
  next.result = adjudicate(next, game.toMove);
  return next;
}
export function winnerScore(game: GameState): number {
  return game.result?.winner ? game.board.size ** 2 + reservePieces(game, game.result.winner).length : 0;
}
export function legalMoves(game: GameState): Move[] {
  if (game.result) return [];
  const moves: Move[] = [], size = game.board.size;
  const color = placementColor(game), stone = reservePieces(game, color, 'stone').length > 0, cap = reservePieces(game, color, 'capstone').length > 0;
  for (let to = 0; to < size ** 2; to++) if (!game.board.cells[to]!.length) {
    if (stone) { moves.push({ type: 'place', to, kind: 'stone', orientation: 'flat' }); if (game.ply >= 2) moves.push({ type: 'place', to, kind: 'stone', orientation: 'standing' }); }
    if (cap && game.ply >= 2) moves.push({ type: 'place', to, kind: 'capstone', orientation: 'flat' });
  }
  if (game.ply < 2) return moves;
  for (let from = 0; from < size ** 2; from++) {
    const stack = game.board.cells[from]!;
    const owned = ownedFromTop(stack, game.toMove);
    if (!owned) continue;
    for (const direction of ['north', 'east', 'south', 'west'] as const) {
      const extend = (remaining: number, drops: number[], at: number) => {
        const target = step(size, at, direction); if (target === null) return;
        const obstacle = game.board.cells[target]!.at(-1);
        if (obstacle?.kind === 'capstone') return;
        if (obstacle?.orientation === 'standing') {
          if (remaining === 1 && stack.at(-1)?.kind === 'capstone') moves.push({ type: 'spread', from, direction, drops: [...drops, 1] });
          return;
        }
        for (let drop = 1; drop <= remaining; drop++) {
          const next = [...drops, drop];
          if (drop === remaining) moves.push({ type: 'spread', from, direction, drops: next });
          else extend(remaining - drop, next, target);
        }
      };
      for (let count = 1; count <= Math.min(carryLimit(size), owned); count++) extend(count, [], from);
    }
  }
  return moves;
}
