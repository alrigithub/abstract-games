import { tzaarPlayableCells } from '@abstract/three-engine';
import type { BoardSnapshot, EnginePiece } from '@abstract/three-engine';
import type { GameState } from './state';

const cells = tzaarPlayableCells();

function cellIndexFor(x: number, y: number): number {
  return cells.find(c => c.x === x && c.y === y)?.index ?? -1;
}

export function gameToSnapshot(game: GameState): BoardSnapshot {
  const boardCells: EnginePiece[][] = cells.map(() => []);
  for (const cell of cells) {
    const stack = game.board.stack({ x: cell.x, y: cell.y });
    if (!stack) continue;
    const idx = cellIndexFor(cell.x, cell.y);
    if (idx < 0) continue;
    boardCells[idx] = stack.pieces.map((p, level) => ({
      id: p.id || `${cell.x},${cell.y},${level}`,
      player: p.player,
      shape: p.kind,
    }));
  }
  return {
    playableCells: cells.length,
    cellCount: cells.length,
    cells: boardCells,
  };
}

export function indexToCoord(index: number): { x: number; y: number } {
  const cell = cells[index];
  if (!cell) throw new RangeError(`cell ${index}`);
  return { x: cell.x, y: cell.y };
}

export function coordToIndex(coord: { x: number; y: number }): number {
  return cells.find(cell => cell.x === coord.x && cell.y === coord.y)?.index ?? -1;
}
