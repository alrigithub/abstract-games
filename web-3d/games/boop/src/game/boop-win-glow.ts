import { cellIndex } from '@abstract/three-engine';
import { bedCellIndices } from './boop-line-clear';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import type { GameView } from './types';

/** Bed cell indices to glow for the current win (three-cat line or all eight cats). */
export function winMarkerCells(view: GameView): number[] {
  const h = view.effects.line_highlight;
  if (h?.kind === 'win') return bedCellIndices(h.line);
  if (h?.kind === 'eight_cats_on_bed' && view.winner) {
    const cells: number[] = [];
    for (let y = 0; y < BOOP_GRID; y++) {
      for (let x = 0; x < BOOP_GRID; x++) {
        const cell = view.board[y]?.[x];
        if (cell?.player === view.winner && cell.kind === 'cat') {
          cells.push(cellIndex(BOOP_GRID, y, x, BOOP_OUTSIDE)!);
        }
      }
    }
    return cells;
  }
  return [];
}
