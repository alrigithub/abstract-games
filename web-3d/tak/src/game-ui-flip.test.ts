import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from './game/engine';
import { playableCells } from './interaction-policy';

/** Minimal flip logic mirrored from createGameUi for unit tests without DOM. */
function flipReserveTop(game: ReturnType<typeof createGame>, source: number) {
  const playable = playableCells(game.board);
  if (source < playable) return null;
  const stack = game.board.cells[source]!;
  const top = stack.at(-1);
  if (!top || top.kind !== 'stone' || game.ply < 2) return null;
  const cells = game.board.cells.slice();
  cells[source] = [
    ...stack.slice(0, -1),
    { ...top, orientation: top.orientation === 'flat' ? ('standing' as const) : ('flat' as const) },
  ];
  return { ...game, board: { ...game.board, cells } };
}

describe('reserve flip orientation', () => {
  it('toggles flat to wall and back on the selected pile', () => {
    let game: GameState = { ...createGame(5), ply: 2, toMove: 'ivory' };
    const playable = playableCells(game.board);
    const source = game.board.cells.findIndex(
      (stack, i) => i >= playable && stack.at(-1)?.color === 'ivory' && stack.at(-1)?.kind === 'stone',
    );
    expect(game.board.cells[source]!.at(-1)!.orientation).toBe('flat');
    game = flipReserveTop(game, source)!;
    expect(game.board.cells[source]!.at(-1)!.orientation).toBe('standing');
    game = flipReserveTop(game, source)!;
    expect(game.board.cells[source]!.at(-1)!.orientation).toBe('flat');
  });
});
