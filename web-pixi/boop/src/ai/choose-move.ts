import type { BoopGameState, PieceKind } from "../engine/types";
import { listLegalPlaces, placePiece } from "../engine/place";

function sortMoves(
  moves: Array<{ row: number; col: number; kind: PieceKind }>
) {
  return [...moves].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row
    if (a.col !== b.col) return a.col - b.col
    if (a.kind === b.kind) return 0
    return a.kind === "kitten" ? -1 : 1
  })
}

export function chooseMove(
  state: BoopGameState
): { row: number; col: number; kind: PieceKind } | null {
  if (state.status.kind !== "playing") return null
  const legal = sortMoves(listLegalPlaces(state))
  for (const move of legal) {
    const next = placePiece(state, move.row, move.col, move.kind)
    if (next !== state && next.status.kind === "won") {
      return move
    }
  }
  return legal[0] ?? null
}
