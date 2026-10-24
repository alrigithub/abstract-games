import type { SceneApi, ThemeId } from './types';

/** Approximate CSS pixels per world unit using two adjacent cells on the board. */
export function pxPerWorldUnit(
  scene: SceneApi,
  cellIndexFn: (row: number, col: number) => number,
): number {
  const a = scene.cellScreen(cellIndexFn(0, 0));
  const b = scene.cellScreen(cellIndexFn(0, 1));
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  return dist > 0 ? dist : 1;
}

export interface DomPlacementGhostOptions {
  className?: string;
  testId?: string;
  theme?: ThemeId;
}

/**
 * Screen-space circular footprint preview (DOM overlay). Gomoku keeps its own
 * Three.js stone ghost in {@link demos/gomoku}; this helper is for flat footprints
 * sized in world units (e.g. Boop kitten vs cat).
 */
export class DomPlacementGhost {
  private readonly el: HTMLDivElement;
  private visible = false;

  constructor(board: HTMLElement, options: DomPlacementGhostOptions = {}) {
    this.el = document.createElement('div');
    this.el.className = options.className ?? 'placement-ghost-footprint';
    if (options.testId) this.el.dataset.testid = options.testId;
    this.el.hidden = true;
    board.appendChild(this.el);
    if (options.theme) this.applyTheme(options.theme);
  }

  applyTheme(theme: ThemeId) {
    this.el.dataset.theme = theme;
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.el.hidden = true;
  }

  showAt(
    scene: SceneApi,
    board: HTMLElement,
    cellIndex: number,
    diameterWorldUnits: number,
    cellIndexFn: (row: number, col: number) => number,
  ) {
    const center = scene.cellScreen(cellIndex);
    const boardRect = board.getBoundingClientRect();
    const pxPerUnit = pxPerWorldUnit(scene, cellIndexFn);
    const diameterPx = diameterWorldUnits * pxPerUnit;

    this.el.style.left = `${center.x - boardRect.left}px`;
    this.el.style.top = `${center.y - boardRect.top}px`;
    this.el.style.width = `${diameterPx}px`;
    this.el.style.height = `${diameterPx}px`;
    this.el.hidden = false;
    this.visible = true;
  }
}
