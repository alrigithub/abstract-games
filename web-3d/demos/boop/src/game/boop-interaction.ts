import {
  cellCoordinates,
  cellIndex,
  createInteraction,
  type InteractionView,
  type SceneApi,
  type Selection,
} from '@abstract/three-engine';
import { primaryPoolCellIndex } from './boop-pool-layout';
import type { BoopController } from './controller';

const GRID = 6;
const OUTSIDE = 2;

export interface BoopInteractionHandle {
  cancel(): void;
  dispose(): void;
  /** Playwright / AI: drag from pool/resting cell index to playable cell index. */
  dragCellToCell(fromIndex: number, toIndex: number, options?: { ai?: boolean }): Promise<void>;
}

export function wireBoopInteraction(
  stage: HTMLElement,
  boardEl: HTMLElement,
  scene: SceneApi,
  getController: () => BoopController,
): BoopInteractionHandle {
  const interaction = createInteraction({
    element: stage,
    getSnapshot: () => getController().getSnapshot(),
    canInteract: () => getController().allowsPointerInteraction(),
    getPickHeight(cell, snap) {
      return getController().pickHeightForCell(cell, snap);
    },
    hitTest: (x, y) => {
      const c = getController();
      return c.allowsPointerInteraction() ? scene.hitTest(x, y) : null;
    },
    onView(view: InteractionView) {
      scene.setInteraction(view);
      boardEl.classList.toggle('is-dragging', view.dragging);
      boardEl.dataset.pickActive = view.selection ? 'true' : 'false';
    },
    onCommit(selection: Selection, target: number) {
      void getController().commitPlacement(selection, target);
    },
  });

  stage.addEventListener(
    'pointerdown',
    event => {
      if (event.button !== 0 || !getController().allowsPointerInteraction()) return;
      queueMicrotask(() => {
        if (interaction.getSelection()) interaction.selectCount(1);
      });
    },
    true,
  );

  stage.addEventListener('contextmenu', event => {
    event.preventDefault();
    interaction.cancel();
  });

  stage.addEventListener(
    'pointerup',
    event => {
      if (event.button !== 0) return;
      if (interaction.getSelection()) return;
      const c = getController();
      if (!c.canInteract() || c.isPlaceMode()) return;
      const cell = scene.hitTest(event.clientX, event.clientY);
      if (cell !== null) void c.handleCellClick(cell);
    },
    true,
  );

  async function dragCellToCell(fromIndex: number, toIndex: number, options?: { ai?: boolean }) {
    const controller = getController();
    if (options?.ai) controller.setAiDragMode(true);
    const from = scene.cellScreen(fromIndex);
    const to = scene.cellScreen(toIndex);
    const pointerInit = (x: number, y: number, type: 'down' | 'move' | 'up'): PointerEventInit => ({
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'up' ? 0 : 1,
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    const down = (x: number, y: number) => {
      stage.dispatchEvent(new PointerEvent('pointerdown', pointerInit(x, y, 'down')));
    };
    const move = (x: number, y: number) => {
      window.dispatchEvent(new PointerEvent('pointermove', pointerInit(x, y, 'move')));
    };
    const up = (x: number, y: number) => {
      window.dispatchEvent(new PointerEvent('pointerup', pointerInit(x, y, 'up')));
    };
    try {
      down(from.x, from.y);
      await new Promise(r => requestAnimationFrame(r));
      move(to.x, to.y);
      await new Promise(r => requestAnimationFrame(r));
      up(to.x, to.y);
      await controller.waitForInflightMove();
    } finally {
      if (options?.ai) controller.setAiDragMode(false);
    }
  }

  return {
    cancel: () => interaction.cancel(),
    dispose: () => interaction.dispose(),
    dragCellToCell,
  };
}

export function poolCellIndex(): number {
  return primaryPoolCellIndex('A', 'kitten');
}

export function aiPoolCellIndex(kind: 'kitten' | 'cat' = 'kitten'): number {
  const row = kind === 'kitten' ? 3 : 5;
  return cellIndex(GRID, row, GRID + 1, OUTSIDE)!;
}

export function cellAt(row: number, col: number): number {
  return cellIndex(GRID, row, col, OUTSIDE)!;
}

export function coords(index: number) {
  return cellCoordinates(GRID, index, OUTSIDE);
}
