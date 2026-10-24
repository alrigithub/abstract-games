import { BED_SIZE } from "../engine/types";
import { nearestCell } from "@abstract/pixi-shared";

export const CELL = 32

export function cellCenter(col: number, row: number) {
  return {
    x: (col - (BED_SIZE - 1) / 2) * CELL,
    y: (row - (BED_SIZE - 1) / 2) * CELL,
  }
}

export function worldToCell(wx: number, wy: number) {
  const hit = nearestCell(wx, wy, CELL, BED_SIZE)
  return hit ? { col: hit.col, row: hit.row } : null
}
