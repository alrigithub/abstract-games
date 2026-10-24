import {
  cellCoordinates,
  cellIndex,
  createInteraction,
  type InteractionView,
  type SceneApi,
  type Selection,
} from '@abstract/three-engine';
import type { BoopController } from './controller';

const GRID = 6;
const OUTSIDE = 2;

export interface BoopInteractionHandle {
  cancel(): void;
  dispose(): void;
  /** Playwright: drag from pool/resting cell index to playable cell index. */
  dragCellToCell(fromIndex: number, toIndex: number): Promise<void>;
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
    canInteract: () => getController().canInteract(),
    getPickHeight(cell, snap) {
      const c = getController();
      if (!c.canInteract()) return 0;
      return c.pickHeightForCell(cell, snap);
    },
    hitTest: (x, y) => {
      const c = getController();
      return c.canInteract() ? scene.hitTest(x, y) : null;
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
      if (event.button !== 0 || !getController().canInteract()) return;
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

  async function dragCellToCell(fromIndex: number, toIndex: number) {
    const from = scene.cellScreen(fromIndex);
    const to = scene.cellScreen(toIndex);
    const down = (x: number, y: number) => {
      stage.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true, pointerId: 1 }),
      );
    };
    const move = (x: number, y: number) => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: x, clientY: y, button: 0, bubbles: true, pointerId: 1 }),
      );
    };
    const up = (x: number, y: number) => {
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: x, clientY: y, button: 0, bubbles: true, pointerId: 1 }),
      );
    };
    down(from.x, from.y);
    await new Promise(r => requestAnimationFrame(r));
    move(to.x, to.y);
    await new Promise(r => requestAnimationFrame(r));
    up(to.x, to.y);
    await new Promise(r => setTimeout(r, 50));
  }

  return {
    cancel: () => interaction.cancel(),
    dispose: () => interaction.dispose(),
    dragCellToCell,
  };
}

export function poolCellIndex(): number {
  return cellIndex(GRID, 3, -2, OUTSIDE)!;
}

export function cellAt(row: number, col: number): number {
  return cellIndex(GRID, row, col, OUTSIDE)!;
}

export function coords(index: number) {
  return cellCoordinates(GRID, index, OUTSIDE);
}
