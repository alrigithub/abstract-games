import * as THREE from 'three';
import type { BoardSnapshot, EnginePiece, Topology } from '../types';

/** Conservative stack heights for camera framing (matches Tak / Go piece scales). */
const FRAME_PIECE_HEIGHT: Record<string, number> = {
  flat: 0.18,
  standing: 0.68,
  capstone: 0.78,
  stone: 0.22,
  ring: 0.05,
  marker: 0.012,
  cat: 0.35,
  kitten: 0.28,
};

function stackTopHeight(stack: EnginePiece[]): number {
  return stack.reduce((sum, piece) => sum + (FRAME_PIECE_HEIGHT[piece.shape] ?? 0.25), 0);
}

export interface SquareGridOptions {
  /** Playable board width/height in cells. */
  size: number;
  /** Include exterior sandbox ring (Tak reserve piles on board in sandbox mode). */
  outsideRows?: number;
}

export function cellIndex(size: number, row: number, col: number, outsideRows = 0): number | null {
  if (!Number.isInteger(size) || size < 1 || !Number.isInteger(row) || !Number.isInteger(col)) return null;
  if (row < -outsideRows || col < -outsideRows || row >= size + outsideRows || col >= size + outsideRows) return null;
  if (row >= 0 && row < size && col >= 0 && col < size) return row * size + col;
  const width = size + outsideRows * 2;
  let exterior: number;
  if (row < 0) exterior = (row + outsideRows) * width + col + outsideRows;
  else if (row < size) exterior = outsideRows * width + row * outsideRows * 2 + (col < 0 ? col + outsideRows : outsideRows + col - size);
  else exterior = outsideRows * width + size * outsideRows * 2 + (row - size) * width + col + outsideRows;
  return size * size + exterior;
}

export function cellCoordinates(size: number, index: number, outsideRows = 0): { row: number; col: number } {
  const width = size + outsideRows * 2;
  if (index < size * size) return { row: Math.floor(index / size), col: index % size };
  let exterior = index - size * size;
  if (exterior < outsideRows * width) return { row: Math.floor(exterior / width) - outsideRows, col: exterior % width - outsideRows };
  exterior -= outsideRows * width;
  if (exterior < size * outsideRows * 2) {
    const offset = exterior % (outsideRows * 2);
    return { row: Math.floor(exterior / (outsideRows * 2)), col: offset < outsideRows ? offset - outsideRows : size + offset - outsideRows };
  }
  exterior -= size * outsideRows * 2;
  return { row: size + Math.floor(exterior / width), col: exterior % width - outsideRows };
}

export function createSquareTopology(options: SquareGridOptions): Topology {
  const { size, outsideRows = 0 } = options;
  const cell = (index: number) => {
    const { row, col } = cellCoordinates(size, index, outsideRows);
    return new THREE.Vector3(col - (size - 1) / 2, 0, row - (size - 1) / 2);
  };
  return {
    cellPosition: (index, _snapshot) => cell(index),
    cellAtWorld(x, z, _snapshot) {
      const col = Math.floor(x + size / 2);
      const row = Math.floor(z + size / 2);
      return cellIndex(size, row, col, outsideRows);
    },
    projectCell: (index, _snapshot) => cell(index),
    frameCorners(snapshot: BoardSnapshot) {
      const points: THREE.Vector3[] = [];
      const pad = 0.55;
      snapshot.cells.forEach((stack, index) => {
        if (!stack.length) return;
        const pos = cell(index);
        const top = stackTopHeight(stack) + 0.08;
        for (const dx of [-pad, pad]) {
          for (const dz of [-pad, pad]) {
            points.push(new THREE.Vector3(pos.x + dx, 0, pos.z + dz), new THREE.Vector3(pos.x + dx, top, pos.z + dz));
          }
        }
      });
      return points;
    },
  };
}
