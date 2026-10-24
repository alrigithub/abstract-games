import type { EffectsView, GameView, PieceKind, PlayerId } from './types';

function cloneBoard(board: GameView['board']): GameView['board'] {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function stripTransientEffects(source: GameView): GameView['effects'] {
  return {
    line_highlight: source.effects.line_highlight,
    displacements: [],
    off_board: [],
    graduated_cells: null,
  };
}

/** Logical bed after applying the first `applied` boop displacements (chain order). */
export function boardAfterDisplacements(
  base: GameView,
  displacements: EffectsView['displacements'],
  applied: number,
  meta: GameView,
): GameView {
  const board = cloneBoard(base.board);
  const n = Math.min(applied, displacements.length);
  for (let i = 0; i < n; i++) {
    const d = displacements[i]!;
    board[d.from.y]![d.from.x] = null;
    board[d.to.y]![d.to.x] = { player: d.player, kind: d.kind };
  }
  return {
    ...base,
    board,
    pools: meta.pools,
    to_move: meta.to_move,
    winner: meta.winner,
    turn_mode: meta.turn_mode,
    effects: stripTransientEffects(meta),
  };
}

/** Keep not-yet-animated off-board pieces visible on the bed at their push origin. */
export function boardWithOffBoardOnBed(
  base: GameView,
  offBoard: EffectsView['off_board'],
  fromIndex: number,
): GameView {
  const board = cloneBoard(base.board);
  for (let k = fromIndex; k < offBoard.length; k++) {
    const o = offBoard[k]!;
    board[o.from.y]![o.from.x] = { player: o.player, kind: o.kind };
  }
  return { ...base, board, effects: stripTransientEffects(base) };
}

export function boardCellAt(view: GameView, x: number, y: number): { player: PlayerId; kind: PieceKind } | null {
  return view.board[y]?.[x] ?? null;
}
