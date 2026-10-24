import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInteraction } from './interaction';
import { INTERACTION } from './constants';
import type { InteractionApi, InteractionOptions, InteractionView } from './types';

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

describe('drag-only interaction', () => {
  let stage: Stage;
  let host: EventTarget;
  let api: InteractionApi;
  let current: InteractionView;
  let commit: ReturnType<typeof vi.fn>;
  let options: InteractionOptions;

  beforeEach(() => {
    vi.useFakeTimers();
    stage = new Stage();
    host = new EventTarget();
    commit = vi.fn();
    vi.stubGlobal('window', host);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    const cells: import('./types').EnginePiece[][] = Array.from({ length: 4 }, () => []);
    cells[0] = Array.from({ length: 5 }, (_, i) => ({ id: String(i), player: 'A', shape: 'flat' }));
    options = {
      element: stage as unknown as HTMLElement,
      getSnapshot: () => ({ playableCells: 4, cellCount: 4, cells }),
      hitTest: x => (x < 100 ? 0 : x < 200 ? 1 : null),
      onView: view => {
        current = view;
      },
      onCommit: commit,
    };
    api = createInteraction(options);
  });

  afterEach(() => {
    api.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requires drag before drop and grows stack every HOLD_INTERVAL', () => {
    pointer(stage, 'pointerdown', 20);
    expect(current.selection?.count).toBe(1);
    vi.advanceTimersByTime(INTERACTION.HOLD_INTERVAL);
    expect(current.selection?.count).toBe(2);
    pointer(host, 'pointerup', 20);
    expect(commit).not.toHaveBeenCalled();
    pointer(stage, 'pointerdown', 20);
    vi.advanceTimersByTime(INTERACTION.HOLD_INTERVAL * 2);
    pointer(host, 'pointermove', 150);
    pointer(host, 'pointerup', 150);
    expect(commit).toHaveBeenCalledWith({ source: 0, count: 3 }, 1);
  });
});
