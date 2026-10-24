import type { BoardState, Color } from "./types";
import { step } from "./engine";

function isRoadCell(board: BoardState, cell: number, color: Color): boolean {
  const top = board.cells[cell]?.at(-1)
  return (
    top?.color === color &&
    (top.kind === "capstone" || top.orientation === "flat")
  )
}

/** Cell indices on a connecting road for `color`, when one exists. */
export function roadCells(board: BoardState, color: Color): number[] {
  const { size, cells } = board
  const road = (cell: number) => isRoadCell({ ...board, cells }, cell, color)

  for (const vertical of [true, false]) {
    const todo: number[] = []
    const seen = new Set<number>()
    const parent = new Map<number, number>()
    let winCell: number | null = null

    for (let i = 0; i < size; i++) {
      const cell = vertical ? i : i * size
      if (road(cell)) {
        todo.push(cell)
        seen.add(cell)
        parent.set(cell, -1)
      }
    }

    while (todo.length && winCell === null) {
      const cell = todo.pop()!
      const atGoal = vertical
        ? Math.floor(cell / size) === size - 1
        : cell % size === size - 1
      if (atGoal) {
        winCell = cell
        break
      }
      for (const dir of ["north", "east", "south", "west"] as const) {
        const next = step(size, cell, dir)
        if (next !== null && !seen.has(next) && road(next)) {
          seen.add(next)
          parent.set(next, cell)
          todo.push(next)
        }
      }
    }

    if (winCell !== null) {
      const path: number[] = []
      let cur: number | undefined = winCell
      while (cur !== undefined && cur >= 0) {
        path.push(cur)
        cur = parent.get(cur)
        if (cur === -1) break
      }
      return path.length ? path : Array.from(seen)
    }
  }
  return []
}
