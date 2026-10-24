import {
  BED_SIZE,
  type Bed,
  type Piece,
  type PieceKind,
  type Player,
  type Pool,
} from "./types"

export function createEmptyBed(): Bed {
  return Array.from({ length: BED_SIZE }, () =>
    Array.from({ length: BED_SIZE }, () => null)
  )
}

export function cloneBed(bed: Bed): Bed {
  return bed.map((row) => row.slice())
}

export function initialPool(): Pool {
  return { kittens: 8, cats: 0, reserveCats: 8 }
}

export function initialPools(): Record<Player, Pool> {
  return {
    black: initialPool(),
    white: initialPool(),
  }
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BED_SIZE && c >= 0 && c < BED_SIZE
}

export function opponent(p: Player): Player {
  return p === "black" ? "white" : "black"
}

export function countOnBed(bed: Bed, player: Player, kind?: PieceKind): number {
  let n = 0
  for (const row of bed) {
    for (const cell of row) {
      if (cell?.owner !== player) continue
      if (kind && cell.kind !== kind) continue
      n++
    }
  }
  return n
}

export function countCatsOnBed(bed: Bed, player: Player): number {
  return countOnBed(bed, player, "cat")
}

export function countPiecesOnBed(bed: Bed, player: Player): number {
  return countOnBed(bed, player)
}

export function returnPieceToPool(pools: Record<Player, Pool>, piece: Piece): void {
  if (piece.kind === "kitten") pools[piece.owner].kittens += 1
  else pools[piece.owner].cats += 1
}

/** Active pieces = in pool + on bed (reserve is out of play). Invariant: always 8. */
export function countActivePieces(
  bed: Bed,
  pool: Pool,
  player: Player
): number {
  return pool.kittens + pool.cats + countPiecesOnBed(bed, player)
}
