import { createSandboxState, OUTSIDE_ROWS } from "./state";
import type { BoardState, Piece } from "./types";

export interface WirePiece {
  cell: number
  level: number
  standing: boolean
}
export interface WireState {
  size: number
  pieces: Record<string, WirePiece>
}

function roster(size: number): Map<string, Piece> {
  if (!Number.isInteger(size) || size < 3 || size > 8)
    throw new Error("Choose a board size from 3 to 8.")
  return new Map(
    createSandboxState(size)
      .cells.flat()
      .map((piece) => [piece.id, piece])
  )
}

/** Fixed piece identities make inventory independent of stacking and Firebase's sparse arrays. */
export function encodeState(state: BoardState): WireState {
  const expected = roster(state.size)
  if (state.cells.length !== (state.size + 2 * OUTSIDE_ROWS) ** 2)
    throw new Error("Invalid sandbox cells.")
  if (
    state.reserveCounts &&
    Object.values(state.reserveCounts).some((kinds) =>
      Object.values(kinds).some((counts) => counts.some((count) => count !== 0))
    )
  )
    throw new Error("All pieces must be on the table.")
  const pieces: Record<string, WirePiece> = {}
  state.cells.forEach((stack, cell) =>
    stack.forEach((piece, level) => {
      const original = expected.get(piece.id)
      if (
        !original ||
        pieces[piece.id] ||
        piece.color !== original.color ||
        piece.kind !== original.kind ||
        (piece.orientation !== "flat" && piece.orientation !== "standing") ||
        (piece.kind === "capstone" && piece.orientation !== "flat")
      )
        throw new Error("Invalid physical inventory.")
      pieces[piece.id] = {
        cell,
        level,
        standing: piece.orientation === "standing",
      }
    })
  )
  if (Object.keys(pieces).length !== expected.size)
    throw new Error("A piece is missing.")
  return { size: state.size, pieces }
}

export function decodeState(raw: WireState): BoardState {
  if (!raw || typeof raw !== "object")
    throw new Error("Invalid sandbox snapshot.")
  const expected = roster(raw.size)
  if (!raw.pieces || Object.keys(raw.pieces).length !== expected.size)
    throw new Error("Invalid physical inventory.")
  const state = createSandboxState(raw.size)
  state.cells = state.cells.map(() => [])
  for (const [id, original] of expected) {
    const value = raw.pieces[id]
    if (
      !value ||
      !Number.isInteger(value.cell) ||
      value.cell < 0 ||
      value.cell >= state.cells.length ||
      !Number.isInteger(value.level) ||
      value.level < 0 ||
      value.level >= expected.size ||
      typeof value.standing !== "boolean" ||
      (original.kind === "capstone" && value.standing)
    )
      throw new Error("Invalid piece position.")
    const stack = state.cells[value.cell]!
    if (stack[value.level])
      throw new Error("Two pieces occupy the same stack level.")
    stack[value.level] = {
      ...original,
      orientation: value.standing ? "standing" : "flat",
    }
  }
  for (const stack of state.cells)
    for (let level = 0; level < stack.length; level++)
      if (!stack[level]) throw new Error("Stack levels must be consecutive.")
  return state
}
