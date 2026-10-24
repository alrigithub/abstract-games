import type { BoardSnapshot, EnginePiece, ReservePick, Selection as EngineSelection } from '@abstract/three-engine';
import type { BoardState, Color, Piece, PieceKind, Reserve, Selection } from './types';

const PLAYER: Record<Color, string> = { ivory: 'A', charcoal: 'B' };

export function pieceShape(kind: PieceKind, orientation: string): string {
  if (kind === 'capstone') return 'capstone';
  return orientation === 'standing' ? 'standing' : 'flat';
}

export function toEnginePiece(piece: Piece): EnginePiece {
  return {
    id: piece.id,
    player: PLAYER[piece.color],
    shape: pieceShape(piece.kind, piece.orientation),
    data: { color: piece.color, kind: piece.kind, orientation: piece.orientation, reservePile: piece.reservePile },
  };
}

export function toEngineSnapshot(board: BoardState): BoardSnapshot {
  return {
    playableCells: board.size ** 2,
    cellCount: board.cells.length,
    cells: board.cells.map(stack => stack.map(toEnginePiece)),
  };
}

export function reserveFromPick(pick: ReservePick): Reserve {
  const color: Color = pick.player === 'A' ? 'ivory' : 'charcoal';
  const kind: PieceKind = pick.shape === 'capstone' ? 'capstone' : 'stone';
  const orientation = pick.shape === 'standing' ? 'standing' : 'flat';
  return { color, kind, orientation: orientation as 'flat' | 'standing', pile: pick.pile };
}

export function toTakSelection(selection: EngineSelection): Selection {
  if (typeof selection.source === 'number') return { source: selection.source, count: selection.count };
  return { source: reserveFromPick(selection.source), count: selection.count };
}
