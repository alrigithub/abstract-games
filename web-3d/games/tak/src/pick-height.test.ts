import { INTERACTION } from '@abstract/three-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionApi, InteractionOptions, InteractionView } from '@abstract/three-engine';
import { createGame } from './game/engine';
import { canFlipSelectedReserve, canPickReserveCell, playableCells } from './interaction-policy';
import { countSelected, createSandboxState } from './state';
import { stackPickLimit } from './pick-height';
import { createTakInteraction, TAP_MOVE_THRESHOLD } from './tak-interaction';
import type { Piece } from './types';

function flat(color: Piece['color'], id: string): Piece {
  return { id, color, kind: 'stone', orientation: 'flat' };
}

describe('press-and-hold stack growth', () => {
  it('grows one piece every HOLD_INTERVAL up to owned-from-top and carry limit', () => {
    const stack = [flat('charcoal', 'b1'), flat('ivory', 'i1'), flat('ivory', 'i2'), flat('ivory', 'i3')];
    const limit = stackPickLimit(stack, 'ivory', true, 5);
    expect(limit).toBe(3);

    const interval = INTERACTION.HOLD_INTERVAL;
    expect(countSelected(0, limit, interval)).toBe(1);
    expect(countSelected(interval - 1, limit, interval)).toBe(1);
    expect(countSelected(interval, limit, interval)).toBe(2);
    expect(countSelected(interval * 2, limit, interval)).toBe(3);
    expect(countSelected(interval * 10, limit, interval)).toBe(3);
  });

  it('caps at carry limit even when more owned pieces exist', () => {
    const stack = Array.from({ length: 7 }, (_, i) => flat('ivory', `i${i}`));
    const limit = stackPickLimit(stack, 'ivory', true, 5);
    expect(limit).toBe(5);
    expect(countSelected(INTERACTION.HOLD_INTERVAL * 4, limit, INTERACTION.HOLD_INTERVAL)).toBe(5);
  });

  it('does not cap sandbox piles on exterior cells', () => {
    const stack = Array.from({ length: 7 }, (_, i) => flat('ivory', `i${i}`));
    expect(stackPickLimit(stack, 'ivory', false, 5)).toBe(7);
  });
});

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

class Stage extends EventTarget {
  captured: number | null = null;
  dataset: Record<string, string> = {};
  setPointerCapture(id: number) {
    this.captured = id;
  }
  hasPointerCapture(id: number) {
    return this.captured === id;
  }
  releasePointerCapture(id: number) {
    this.captured = null;
    pointer(this, 'lostpointercapture', 0, 0, id);
  }
}

function pointer(target: EventTarget, type: string, x: number, y = 0, id = 1) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, button: 0, isPrimary: true });
  target.dispatchEvent(event);
  return event as PointerEvent;
}

describe('createTakInteraction tap-select', () => {
  let stage: Stage;
  let host: EventTarget;
  let api: InteractionApi;
  let current: InteractionView;
  let commit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stage = new Stage();
    host = new EventTarget();
    commit = vi.fn();
    vi.stubGlobal('window', host);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    const cells: import('@abstract/three-engine').EnginePiece[][] = Array.from({ length: 6 }, () => []);
    cells[4] = [{ id: 'r1', player: 'A', shape: 'flat' }];
    cells[0] = [{ id: 'b1', player: 'A', shape: 'flat' }];
    const options: InteractionOptions = {
      element: stage as unknown as HTMLElement,
      getSnapshot: () => ({ playableCells: 4, cellCount: 6, cells }),
      hitTest: x => (x < 100 ? 0 : x < 200 ? 1 : x < 300 ? 4 : null),
      onView: view => {
        current = view;
      },
      onCommit: commit,
    };
    api = createTakInteraction(options);
  });

  afterEach(() => {
    api.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses tap move threshold', () => {
    expect(TAP_MOVE_THRESHOLD).toBe(8);
  });

  it('keeps reserve selection after tap without drag', () => {
    pointer(stage, 'pointerdown', 250);
    pointer(host, 'pointerup', 250);
    expect(current.selection?.source).toBe(4);
    expect(current.dragging).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });

  it('places on second tap and clears selection', () => {
    pointer(stage, 'pointerdown', 250);
    pointer(host, 'pointerup', 250);
    pointer(stage, 'pointerdown', 150);
    pointer(host, 'pointerup', 150);
    expect(commit).toHaveBeenCalledWith({ source: 4, count: 1 }, 1);
    expect(current.selection).toBeNull();
  });

  it('cancels when tapping the selected reserve again', () => {
    pointer(stage, 'pointerdown', 250);
    pointer(host, 'pointerup', 250);
    pointer(stage, 'pointerdown', 250);
    pointer(host, 'pointerup', 250);
    expect(current.selection).toBeNull();
    expect(commit).not.toHaveBeenCalled();
  });

  it('cancels when tapping empty space while selected', () => {
    pointer(stage, 'pointerdown', 250);
    pointer(host, 'pointerup', 250);
    pointer(stage, 'pointerdown', 400);
    pointer(host, 'pointerup', 400);
    expect(current.selection).toBeNull();
  });
});
