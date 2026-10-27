import {
  cellCoordinates,
  cellIndex,
  createTapInteraction,
  DomPlacementGhost,
  tapTransfer,
  type InteractionView,
  type SceneApi,
  type Selection,
} from '@abstract/three-engine';
import { nearestEmptyBedCell } from './boop-bed-snap';
import { boopFootprintWorldUnits } from './boop-placement-footprints';
import { BOOP_START_POOL_COUNTS, primaryPoolCellIndex } from './boop-pool-layout';
import type { BoopController } from './controller';
import type { PieceKind } from './types';

import { BOOP_GRID as GRID, BOOP_OUTSIDE as OUTSIDE } from './boop-grid';

const EMPTY_VIEW: InteractionView = {
  selection: null,
  dragging: false,
  pointer: null,
  origin: null,
  target: null,
  progress: 0,
};

export interface BoopInteractionHandle {
  cancel(): void;
  dispose(): void;
  setStickyKind(kind: PieceKind): void;
  /** Programmatic tap place for AI (pool/resting → bed). */
  tapPlaceOnBed(fromIndex: number, toIndex: number, options?: { ai?: boolean }): Promise<void>;
  previewGhostAt(cellIndex: number, kind: PieceKind): void;
  hideGhost(): void;
}

function isPlayableEmptyBed(
  index: number,
  coords: (index: number) => { row: number; col: number },
  isEmpty: (row: number, col: number) => boolean,
): boolean {
  const { row, col } = coords(index);
  if (row < 0 || row >= GRID || col < 0 || col >= GRID) return false;
  return isEmpty(row, col);
}

export function wireBoopInteraction(
  stage: HTMLElement,
  boardEl: HTMLElement,
  scene: SceneApi,
  getController: () => BoopController,
  ghost: DomPlacementGhost,
): BoopInteractionHandle {
  const cellAt = (row: number, col: number) => cellIndex(GRID, row, col, OUTSIDE)!;
  const coords = (index: number) => cellCoordinates(GRID, index, OUTSIDE);
  let stickyBedCell: number | null = null;

  function bedCellAtPointer(clientX: number, clientY: number): number | null {
    const c = getController();
    const cell = nearestEmptyBedCell(
      scene,
      clientX,
      clientY,
      cellAt,
      (row, col) => c.isBedCellEmpty(row, col),
      { stickyCell: stickyBedCell },
    );
    if (cell !== null) stickyBedCell = cell;
    return cell;
  }

  function clearEngineCarry() {
    scene.setInteraction(EMPTY_VIEW);
    boardEl.classList.toggle('is-dragging', false);
    boardEl.dataset.pickActive = 'false';
  }

  function updateGhost(clientX: number, clientY: number) {
    const c = getController();
    if (!c.canInteract() || !c.isPlaceMode()) {
      ghost.hide();
      return;
    }
    const cell = bedCellAtPointer(clientX, clientY);
    if (cell === null || !isPlayableEmptyBed(cell, coords, (row, col) => c.isBedCellEmpty(row, col))) {
      ghost.hide();
      return;
    }
    const kind = c.effectiveStickyKind();
    ghost.showAt(scene, boardEl, cell, boopFootprintWorldUnits(kind), cellAt);
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
      if (!c.allowsPointerInteraction()) return null;
      if (c.isPlaceMode()) return bedCellAtPointer(x, y);
      return scene.hitTest(x, y);
    },
    onView(view: InteractionView) {
      const c = getController();
      if (!c.isReady() || c.isPlaceMode()) return;
      scene.setInteraction(view);
      boardEl.classList.toggle('is-dragging', false);
      boardEl.dataset.pickActive = view.selection ? 'true' : 'false';
    },
    onCommit(selection: Selection, target: number) {
      void getController().commitPlacement(selection, target);
    },
  });

  stage.addEventListener(
    'pointermove',
    event => {
      if (getController().isPlaceMode() && getController().canInteract()) {
        updateGhost(event.clientX, event.clientY);
      }
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
        const cell = bedCellAtPointer(event.clientX, event.clientY);
        if (cell === null) return;
        if (c.trySelectPoolAtCell(cell)) {
          updateGhost(event.clientX, event.clientY);
          return;
        }
        void c.tapPlaceOnBed(cell);
        ghost.hide();
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
    clearEngineCarry();
    ghost.hide();
  });

  boardEl.addEventListener('camera-change', () => {
    const c = getController();
    if (!c.canInteract() || !c.isPlaceMode()) return;
    const cell = boardEl.dataset.ghostCell;
    const kind = boardEl.dataset.ghostKind as PieceKind | undefined;
    if (cell && kind) {
      ghost.showAt(scene, boardEl, Number(cell), boopFootprintWorldUnits(kind), cellAt);
    }
  });

  clearEngineCarry();

  async function tapPlaceOnBed(fromIndex: number, toIndex: number, options?: { ai?: boolean }) {
    const controller = getController();
    if (options?.ai) controller.setAiDragMode(true);
    try {
      ghost.hide();
      await tapTransfer(interaction, fromIndex, toIndex);
      await controller.waitForInflightMove();
    } finally {
      if (options?.ai) controller.setAiDragMode(false);
      clearEngineCarry();
    }
  }

  return {
    cancel: () => {
      interaction.cancel();
      clearEngineCarry();
      stickyBedCell = null;
      ghost.hide();
    },
    dispose: () => {
      interaction.dispose();
      ghost.hide();
    },
    setStickyKind: kind => getController().setStickyKind(kind),
    tapPlaceOnBed,
    previewGhostAt(index, kind) {
      boardEl.dataset.ghostCell = String(index);
      boardEl.dataset.ghostKind = kind;
      ghost.showAt(scene, boardEl, index, boopFootprintWorldUnits(kind), cellAt);
    },
    hideGhost() {
      delete boardEl.dataset.ghostCell;
      delete boardEl.dataset.ghostKind;
      ghost.hide();
    },
  };
}

export function poolCellIndex(): number {
  return primaryPoolCellIndex('A', 'kitten', BOOP_START_POOL_COUNTS);
}

export function aiPoolCellIndex(kind: 'kitten' | 'cat' = 'kitten'): number {
  return primaryPoolCellIndex('B', kind, BOOP_START_POOL_COUNTS);
}

export function cellAt(row: number, col: number): number {
  return cellIndex(GRID, row, col, OUTSIDE)!;
}

export function coords(index: number) {
  return cellCoordinates(GRID, index, OUTSIDE);
}
