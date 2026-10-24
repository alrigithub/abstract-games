import { describe, expect, it } from 'vitest';
import { createGame } from './game/engine';
import { canFlipSelectedReserve, canPickReserveCell, playableCells } from './interaction-policy';
import { createSandboxState } from './state';

describe('canPickReserveCell', () => {
  it('allows all reserve piles in sandbox', () => {
    const state = createSandboxState(5);
    const reserveCell = playableCells(state);
    expect(canPickReserveCell(state, null, reserveCell, true, null)).toBe(true);
  });

  it('rejects the human own reserve during the opening (opponent flat only)', () => {
    const game = createGame(5);
    const state = game.board;
    const playable = playableCells(state);
    const ivoryReserve = state.cells.findIndex(
      (stack, i) => i >= playable && stack.at(-1)?.color === 'ivory' && stack.at(-1)?.kind === 'stone',
    );
    const charcoalReserve = state.cells.findIndex(
      (stack, i) => i >= playable && stack.at(-1)?.color === 'charcoal' && stack.at(-1)?.kind === 'stone',
    );
    expect(ivoryReserve).toBeGreaterThanOrEqual(playable);
    expect(charcoalReserve).toBeGreaterThanOrEqual(playable);
    expect(canPickReserveCell(state, game, ivoryReserve, false, 'ivory')).toBe(false);
    expect(canPickReserveCell(state, game, charcoalReserve, false, 'ivory')).toBe(true);
  });

  it('rejects enemy reserve after the opening', () => {
    const game = { ...createGame(5), ply: 2, toMove: 'ivory' as const };
    const state = game.board;
    const playable = playableCells(state);
    const charcoalReserve = state.cells.findIndex(
      (stack, i) => i >= playable && stack.at(-1)?.color === 'charcoal' && stack.at(-1)?.kind === 'stone',
    );
    const ivoryReserve = state.cells.findIndex(
      (stack, i) => i >= playable && stack.at(-1)?.color === 'ivory' && stack.at(-1)?.kind === 'stone',
    );
    expect(canPickReserveCell(state, game, charcoalReserve, false, 'ivory')).toBe(false);
    expect(canPickReserveCell(state, game, ivoryReserve, false, 'ivory')).toBe(true);
  });
});

describe('canFlipSelectedReserve', () => {
  it('allows flipping a selected flat stone reserve pile', () => {
    const game = { ...createGame(5), ply: 2, toMove: 'ivory' as const };
    const state = game.board;
    const playable = playableCells(state);
    const ivoryReserve = state.cells.findIndex(
      (stack, i) => i >= playable && stack.at(-1)?.color === 'ivory' && stack.at(-1)?.kind === 'stone',
    );
    expect(canFlipSelectedReserve(state, game, ivoryReserve, false)).toBe(true);
  });

  it('rejects capstone reserve piles', () => {
    const game = { ...createGame(5), ply: 2, toMove: 'ivory' as const };
    const state = game.board;
    const playable = playableCells(state);
    const capCell = state.cells.findIndex(
      (stack, i) => i >= playable && stack.at(-1)?.color === 'ivory' && stack.at(-1)?.kind === 'capstone',
    );
    expect(capCell).toBeGreaterThanOrEqual(playable);
    expect(canFlipSelectedReserve(state, game, capCell, false)).toBe(false);
  });
});
