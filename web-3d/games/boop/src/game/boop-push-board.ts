import type { EffectsView, GameView, MoveJson, PieceKind, PlayerId } from './types';

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

/**
 * Bed layout after place + boops, before graduation/win line cells are cleared in rules state.
 * Keeps the third kitten (and pushed line) visible while outcome animations run.
 */
export function boardBeforeGraduationClear(
  before: GameView,
  move: MoveJson,
  actor: PlayerId,
  effects: Pick<EffectsView, 'displacements' | 'off_board'>,
): GameView['board'] {
  const board = cloneBoard(before.board);
  if (move.type === 'place') {
    board[move.y]![move.x] = { player: actor, kind: move.piece };
  }
  for (const d of effects.displacements) {
    board[d.from.y]![d.from.x] = null;
    board[d.to.y]![d.to.x] = { player: d.player, kind: d.kind };
  }
  for (const o of effects.off_board) {
    board[o.from.y]![o.from.x] = null;
  }
  return board;
}

/** Hold pool counts until graduation removal finishes (rules state updates cats early). */
export function poolsDuringMoveAnimation(
  before: GameView,
  after: GameView,
  move: MoveJson,
  actor: PlayerId,
): GameView['pools'] {
  if (!after.effects.graduated_cells?.length) return after.pools;
  const pools: GameView['pools'] = [
    { ...before.pools[0]! },
    { ...before.pools[1]! },
  ];
  if (move.type === 'place') {
    const idx = actor === 'A' ? 0 : 1;
    const pool = { ...pools[idx]! };
    if (move.piece === 'kitten') pool.kittens_in_hand = Math.max(0, pool.kittens_in_hand - 1);
    else pool.cats_in_hand = Math.max(0, pool.cats_in_hand - 1);
    pools[idx] = pool;
  }
  return pools;
}

export function viewDuringMechanicalEffects(
  before: GameView,
  after: GameView,
  move: MoveJson,
  actor: PlayerId,
): GameView {
  return {
    ...after,
    board: boardBeforeGraduationClear(before, move, actor, after.effects),
    pools: poolsDuringMoveAnimation(before, after, move, actor),
    effects: stripTransientEffects(after),
  };
}

export function viewAfterPlacementStep(
  before: GameView,
  after: GameView,
  move: MoveJson,
  actor: PlayerId,
): GameView {
  return {
    ...before,
    board: boardBeforeGraduationClear(before, move, actor, { displacements: [], off_board: [] }),
    pools: poolsDuringMoveAnimation(before, after, move, actor),
    effects: stripTransientEffects(after),
  };
}
