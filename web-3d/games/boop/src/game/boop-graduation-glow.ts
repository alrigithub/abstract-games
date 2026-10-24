import { cellIndex, type BoardAssistState } from '@abstract/three-engine';
import { BOOP_CAT_FOOTPRINT_WORLD } from './boop-placement-footprints';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';

/** Visual-only cue duration (matches Gomoku win-glow celebration). */
export const BOOP_GRADUATION_GLOW_MS = 2000;

const HALO_SCALE = 2.2;

/** Warm run halos under the three graduating bed cells (engine board-assist celebration colour). */
export function graduationLineAssist(line: readonly [number, number][]): BoardAssistState {
  const markerCells = line.map(([x, y]) => cellIndex(BOOP_GRID, y, x, BOOP_OUTSIDE)!);
  return {
    runGlows: [{ markerCells, strength: 'announce' }],
    runGlowStyle: { markerRadius: BOOP_CAT_FOOTPRINT_WORLD / 2, haloScale: HALO_SCALE },
  };
}
