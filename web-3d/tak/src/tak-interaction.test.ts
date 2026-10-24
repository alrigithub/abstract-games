import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionApi, InteractionOptions, InteractionView } from '@abstract/three-engine';
import { createTakInteraction, TAP_MOVE_THRESHOLD } from './tak-interaction';

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
  let options: InteractionOptions;

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
    options = {
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
