import { pxPerWorldUnit, type SceneApi } from '@abstract/three-engine';
import { BOOP_GRID as GRID } from './boop-grid';

export interface BedSnapOptions {
  /** Screen px from cell centre to accept (includes gaps between cells). */
  maxSnapPx?: number;
  /** Prefer the current cell until pointer moves clearly closer to another. */
  stickyCell?: number | null;
}

/**
 * Nearest empty playable bed cell under the pointer (forgiving snap across tile gaps).
 * Pure interaction helper — does not read game rules beyond the supplied emptiness check.
 */
export function nearestEmptyBedCell(
  scene: SceneApi,
  clientX: number,
  clientY: number,
  cellIndexFn: (row: number, col: number) => number,
  isEmptyBed: (row: number, col: number) => boolean,
  options: BedSnapOptions = {},
): number | null {
  const pxPerUnit = pxPerWorldUnit(scene, cellIndexFn);
  const maxSnapPx = options.maxSnapPx ?? pxPerUnit * 0.78;
  const stickyPx = pxPerUnit * 0.88;
  const switchBiasPx = pxPerUnit * 0.12;

  let best: { index: number; dist: number } | null = null;

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (!isEmptyBed(row, col)) continue;
      const index = cellIndexFn(row, col);
      const center = scene.cellScreen(index);
      const dist = Math.hypot(center.x - clientX, center.y - clientY);
      if (dist > maxSnapPx) continue;
      if (!best || dist < best.dist) best = { index, dist };
    }
  }

  const sticky = options.stickyCell;
  if (sticky != null && best && sticky !== best.index) {
    const { row, col } = rowColFromIndex(sticky, cellIndexFn);
    if (row >= 0 && isEmptyBed(row, col)) {
      const stickyCenter = scene.cellScreen(sticky);
      const stickyDist = Math.hypot(stickyCenter.x - clientX, stickyCenter.y - clientY);
      if (stickyDist <= stickyPx && best.dist > stickyDist - switchBiasPx) {
        return sticky;
      }
    }
  }

  return best?.index ?? null;
}

function rowColFromIndex(index: number, cellIndexFn: (row: number, col: number) => number): { row: number; col: number } {
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (cellIndexFn(row, col) === index) return { row, col };
    }
  }
  return { row: -1, col: -1 };
}
