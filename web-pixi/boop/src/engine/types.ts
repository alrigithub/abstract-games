export const BED_SIZE = 6 as const

export type Player = "black" | "white"
export type PieceKind = "kitten" | "cat"
export type Piece = { owner: Player; kind: PieceKind }
export type Cell = Piece | null
export type Bed = Cell[][]

/** In-hand pieces; `reserveCats` are out of play until graduation promotes them. */
export type Pool = { kittens: number; cats: number; reserveCats: number }

export type GameStatus =
  | { kind: "playing"; toMove: Player }
  | { kind: "won"; winner: Player }

export type BoopEvent = {
  from: { r: number; c: number }
  to: { r: number; c: number } | null
  piece: Piece
}

export type WinLineCell = { r: number; c: number }

export type BoopGameState = {
  bed: Bed
  pools: Record<Player, Pool>
  status: GameStatus
  lastBoops: BoopEvent[]
  /** Set when `status.kind === "won"` via three cats in a row. */
  winningLine?: WinLineCell[]
}
