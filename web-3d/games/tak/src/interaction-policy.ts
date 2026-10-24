import { placementColor } from './game/engine';
import type { GameState } from './game/engine';
import type { BoardState, Color, Piece } from './types';

export function playableCells(state: BoardState): number {
  return state.size ** 2;
}

export function isReserveCell(state: BoardState, cell: number): boolean {
  return cell >= playableCells(state);
}

function topPiece(stack: Piece[] | undefined): Piece | undefined {
  return stack?.at(-1);
}

/** Whether a reserve pile cell may be picked on the current turn (game mode only). */
export function canPickReserveCell(
  state: BoardState,
  game: GameState | null,
  cell: number,
  sandbox: boolean,
  humanColor: Color | null,
): boolean {
  if (sandbox || !game) return true;
  if (!isReserveCell(state, cell)) return false;
  const stack = state.cells[cell];
  const top = topPiece(stack);
  if (!top || !stack?.length) return false;

  if (game.ply < 2) {
    const placeColor = placementColor(game);
    return top.color === placeColor && top.kind === 'stone' && top.orientation === 'flat';
  }

  if (!humanColor || game.toMove !== humanColor) return false;
  return top.color === humanColor;
}

/** Whether a board or reserve cell may start a pick (game mode applies reserve rules). */
export function canPickCell(
  state: BoardState,
  game: GameState | null,
  cell: number,
  sandbox: boolean,
  humanColor: Color | null,
  pickHeight: (cell: number) => number,
): boolean {
  if (pickHeight(cell) <= 0) return false;
  if (sandbox || !game) return true;
  if (isReserveCell(state, cell)) return canPickReserveCell(state, game, cell, sandbox, humanColor);
  return true;
}

export function canFlipSelectedReserve(
  state: BoardState,
  game: GameState | null,
  cell: number,
  sandbox: boolean,
): boolean {
  if (typeof cell !== 'number' || cell < 0) return false;
  const stack = state.cells[cell];
  const top = topPiece(stack);
  if (!top || top.kind !== 'stone') return false;
  if (sandbox) return true;
  if (!game || game.ply < 2 || game.result) return false;
  if (!isReserveCell(state, cell)) return false;
  return top.color === game.toMove;
}
