import {
  cellCoordinates,
  cellIndex,
  createTapInteraction,
  tapTransfer,
  type InteractionView,
  type SceneApi,
  type Selection,
} from '@abstract/three-engine';
import { primaryPoolCellIndex } from './boop-pool-layout';
import type { BoopController } from './controller';
import type { PieceKind } from './types';

const GRID = 6;
const OUTSIDE = 2;

export interface BoopInteractionHandle {
  cancel(): void;
  dispose(): void;
  setStickyKind(kind: PieceKind): void;
  /** Programmatic tap place for AI (pool/resting → bed). */
  tapPlaceOnBed(fromIndex: number, toIndex: number, options?: { ai?: boolean }): Promise<void>;
}

export function wireBoopInteraction(
  stage: HTMLElement,
  boardEl: HTMLElement,
  scene: SceneApi,
  getController: () => BoopController,
): BoopInteractionHandle {
  let hoverView: InteractionView = {
    selection: null,
    dragging: false,
    pointer: null,
    origin: null,
    target: null,
    progress: 0,
  };

  function publishView(view: InteractionView) {
    hoverView = view;
    scene.setInteraction(view);
    boardEl.classList.toggle('is-dragging', false);
    boardEl.dataset.pickActive = view.selection ? 'true' : 'false';
  }

  function placeHoverView(clientX: number, clientY: number) {
    const c = getController();
    if (!c.canInteract() || !c.isPlaceMode()) return;
    const target = scene.hitTest(clientX, clientY);
    const kind = c.effectiveStickyKind();
    const source = c.sourceCellForKind(kind);
    publishView({
      selection: { source, count: 1 },
      dragging: false,
      pointer: { x: clientX, y: clientY },
      origin: null,
      target,
      progress: 0,
    });
  }

  const interaction = createTapInteraction({
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
      const c = getController();
      if (!c.isReady() || c.isPlaceMode()) return;
      publishView(view);
    },
    onCommit(selection: Selection, target: number) {
      void getController().commitPlacement(selection, target);
    },
  });

  stage.addEventListener(
    'pointermove',
    event => {
      if (getController().isPlaceMode() && getController().canInteract()) placeHoverView(event.clientX, event.clientY);
    },
    true,
  );

  stage.addEventListener(
    'pointerup',
    event => {
      if (event.button !== 0) return;
      const c = getController();
      if (!c.canInteract()) return;
      if (c.isPlaceMode()) {
        const cell = scene.hitTest(event.clientX, event.clientY);
        if (cell !== null) void c.tapPlaceOnBed(cell);
        return;
      }
      if (interaction.getSelection()) return;
      const cell = scene.hitTest(event.clientX, event.clientY);
      if (cell !== null) void c.handleCellClick(cell);
    },
    true,
  );

  stage.addEventListener('contextmenu', event => {
    event.preventDefault();
    interaction.cancel();
    publishView({ selection: null, dragging: false, pointer: null, origin: null, target: null, progress: 0 });
  });

  async function tapPlaceOnBed(fromIndex: number, toIndex: number, options?: { ai?: boolean }) {
    const controller = getController();
    if (options?.ai) controller.setAiDragMode(true);
    try {
      await tapTransfer(interaction, fromIndex, toIndex);
      await controller.waitForInflightMove();
    } finally {
      if (options?.ai) controller.setAiDragMode(false);
    }
  }

  return {
    cancel: () => {
      interaction.cancel();
      publishView({ selection: null, dragging: false, pointer: null, origin: null, target: null, progress: 0 });
    },
    dispose: () => interaction.dispose(),
    setStickyKind: kind => getController().setStickyKind(kind),
    tapPlaceOnBed,
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
