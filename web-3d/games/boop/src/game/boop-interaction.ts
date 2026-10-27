import {
  cellCoordinates,
  cellIndex,
  createTapInteraction,
  tapTransfer,
  type InteractionView,
  type SceneApi,
  type Selection,
} from '@abstract/three-engine';
import { bedCellFromPlayfield, bedColumnWorldX, bedRowWorldZ } from './boop-bed-snap';
import { BOOP_START_POOL_COUNTS, primaryPoolCellIndex } from './boop-pool-layout';
import type { BoopScreenMarker } from './boop-screen-marker';
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
  /** Keep a visible marker on its cell after the active vase size changes. */
  refreshMarker(): void;
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
  marker: BoopScreenMarker,
): BoopInteractionHandle {
  const coords = (index: number) => cellCoordinates(GRID, index, OUTSIDE);
  const frameRect = { left: 0, top: 0, width: 0, height: 0 };
  const playfieldHit = { x: 0, z: 0 };
  const screenPt = { x: 0, y: 0 };
  let followPointer = false;
  let pointerX = 0;
  let pointerY = 0;
  let sampledX = Number.NaN;
  let sampledY = Number.NaN;
  let pinnedCell: number | null = null;
  let pinnedKind: PieceKind | null = null;
  let activeCell: number | null = null;
  let raf = 0;

  function bedCellAtPointer(clientX: number, clientY: number): number | null {
    scene.refreshPointerFrame(frameRect);
    if (!scene.hitPlayfield(clientX, clientY, playfieldHit)) return null;
    const cell = bedCellFromPlayfield(playfieldHit.x, playfieldHit.z);
    if (cell === null || !isPlayableEmptyBed(cell, coords, (row, col) => getController().isBedCellEmpty(row, col))) {
      return null;
    }
    return cell;
  }

  function ensureMarkerLoop() {
    if (raf) return;
    raf = requestAnimationFrame(tickMarker);
  }

  function stopMarkerLoop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function clearEngineCarry() {
    scene.setInteraction(EMPTY_VIEW);
    boardEl.classList.toggle('is-dragging', false);
    boardEl.dataset.pickActive = 'false';
  }

  function clearMarker() {
    activeCell = null;
    delete boardEl.dataset.ghostCell;
    delete boardEl.dataset.ghostKind;
    marker.hide();
    stopMarkerLoop();
  }

  function tickMarker(now: number) {
    raf = 0;
    const c = getController();
    const place = c.canInteract() && c.isPlaceMode();
    if (!place && pinnedCell === null) {
      clearMarker();
      return;
    }

    scene.refreshPointerFrame(frameRect);
    let cell = pinnedCell;
    let kind = pinnedKind ?? c.effectiveStickyKind();
    if (followPointer && place) {
      cell = scene.hitPlayfield(pointerX, pointerY, playfieldHit)
        ? bedCellFromPlayfield(playfieldHit.x, playfieldHit.z)
        : null;
      kind = c.effectiveStickyKind();
    }
    if (cell === null || !isPlayableEmptyBed(cell, coords, (row, col) => c.isBedCellEmpty(row, col))) {
      clearMarker();
      return;
    }

    const { row, col } = coords(cell);
    scene.projectToScreenInto(bedColumnWorldX(col), 0, bedRowWorldZ(row), screenPt);
    // Glide only when the pointer crosses into another cell. Camera orbit/zoom
    // retargets the same frame so the ring stays on the cell centre.
    const pointerMoved = pointerX !== sampledX || pointerY !== sampledY;
    sampledX = pointerX;
    sampledY = pointerY;
    const hop = followPointer && pointerMoved && activeCell !== null && activeCell !== cell;
    activeCell = cell;
    if (boardEl.dataset.ghostCell !== String(cell)) boardEl.dataset.ghostCell = String(cell);
    if (boardEl.dataset.ghostKind !== kind) boardEl.dataset.ghostKind = kind;
    marker.glideTo(screenPt.x - frameRect.left, screenPt.y - frameRect.top, kind, now, hop);
    if (marker.isGliding()) ensureMarkerLoop();
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
      if (!getController().isPlaceMode() || !getController().canInteract()) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      followPointer = true;
      pinnedCell = null;
      pinnedKind = null;
      ensureMarkerLoop();
    },
    { capture: true, passive: true },
  );

  stage.addEventListener('pointerleave', () => {
    followPointer = false;
    if (pinnedCell === null) clearMarker();
  });

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
          pointerX = event.clientX;
          pointerY = event.clientY;
          followPointer = true;
          ensureMarkerLoop();
          return;
        }
        void c.tapPlaceOnBed(cell);
        clearMarker();
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
    clearMarker();
  });

  boardEl.addEventListener('camera-change', () => {
    if (activeCell === null && pinnedCell === null && !followPointer) return;
    ensureMarkerLoop();
  });

  clearEngineCarry();

  async function tapPlaceOnBed(fromIndex: number, toIndex: number, options?: { ai?: boolean }) {
    const controller = getController();
    if (options?.ai) controller.setAiDragMode(true);
    try {
      clearMarker();
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
      followPointer = false;
      pinnedCell = null;
      pinnedKind = null;
      clearMarker();
    },
    dispose: () => {
      interaction.dispose();
      followPointer = false;
      pinnedCell = null;
      pinnedKind = null;
      clearMarker();
    },
    setStickyKind: kind => getController().setStickyKind(kind),
    tapPlaceOnBed,
    previewGhostAt(index, kind) {
      pinnedCell = index;
      pinnedKind = kind;
      followPointer = false;
      activeCell = null;
      ensureMarkerLoop();
    },
    refreshMarker() {
      if (activeCell === null && pinnedCell === null) return;
      ensureMarkerLoop();
    },
    hideGhost() {
      clearMarker();
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
