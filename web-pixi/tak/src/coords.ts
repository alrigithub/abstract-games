import { nearestCell } from "@shared/hit";

export const CELL = 32

export function cellCenter(col: number, row: number, size: number) {
  return {
    x: (col - (size - 1) / 2) * CELL,
    y: (row - (size - 1) / 2) * CELL,
  }
}

export function worldToCell(wx: number, wy: number, size: number) {
  const hit = nearestCell(wx, wy, CELL, size)
  return hit ? { col: hit.col, row: hit.row } : null
}

export function cellToIndex(col: number, row: number, size: number): number {
  return row * size + col
}
