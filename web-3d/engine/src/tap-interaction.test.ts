import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTapInteraction, tapTransfer, TAP_MOVE_THRESHOLD } from './tap-interaction';
import type { InteractionApi, InteractionOptions, InteractionView } from './types';

class Stage extends EventTarget {
  dataset: Record<string, string> = {};
}

function pointer(target: EventTarget, type: string, x: number, y = 0, id = 1) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, button: 0, isPrimary: true });
  target.dispatchEvent(event);
  return event as PointerEvent;
}

describe('createTapInteraction', () => {
  let stage: Stage;
  let host: EventTarget;
  let api: InteractionApi;
  let current: InteractionView;
  let commit: ReturnType<typeof vi.fn>;
  let options: InteractionOptions;

  beforeEach(() => {
    stage = new Stage();
    host = new EventTarget();
    commit = vi.fn();
    vi.stubGlobal('window', host);
    const cells: import('./types').EnginePiece[][] = Array.from({ length: 4 }, () => []);
    cells[0] = [{ id: 'a', player: 'A', shape: 'flat' }];
    cells[1] = [];
    options = {
      element: stage as unknown as HTMLElement,
      getSnapshot: () => ({ playableCells: 4, cellCount: 4, cells }),
      hitTest: x => (x < 100 ? 0 : x < 200 ? 1 : null),
      onView: view => {
        current = view;
      },
      onCommit: commit,
    };
    api = createTapInteraction(options);
  });

  afterEach(() => {
    api.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses tap move threshold', () => {
    expect(TAP_MOVE_THRESHOLD).toBe(8);
  });

  it('selects on first tap and commits on second without dragging', () => {
    pointer(stage, 'pointerdown', 20);
    pointer(host, 'pointerup', 20);
    expect(current.selection?.source).toBe(0);
    expect(current.dragging).toBe(false);
    pointer(stage, 'pointerdown', 150);
    pointer(host, 'pointerup', 150);
    expect(commit).toHaveBeenCalledWith({ source: 0, count: 1 }, 1);
    expect(current.selection).toBeNull();
  });

  it('tapTransfer selects then drops programmatically', async () => {
    await tapTransfer(api, 0, 1);
    expect(commit).toHaveBeenCalledWith({ source: 0, count: 1 }, 1);
  });
});
