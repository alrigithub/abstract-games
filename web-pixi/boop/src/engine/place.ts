import {
  cloneBed,
  countCatsOnBed,
  countPiecesOnBed,
  inBounds,
  initialPool,
  opponent,
  returnPieceToPool,
} from "./board"
import type {
  Bed,
  BoopEvent,
  BoopGameState,
  Piece,
  PieceKind,
  Player,
  Pool,
} from "./types"
import { BED_SIZE } from "./types"

const ALL_DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

const LINE_DIRS: Array<[number, number]> = ALL_DIRS

function clonePools(pools: Record<Player, Pool>): Record<Player, Pool> {
  return {
    black: { ...pools.black },
    white: { ...pools.white },
  }
}

function isBracedAlongPush(
  bed: Bed,
  nr: number,
  nc: number,
  dr: number,
  dc: number,
  placedR: number,
  placedC: number
): boolean {
  let count = 1
  let cr = nr - dr
  let cc = nc - dc
  while (inBounds(cr, cc) && bed[cr][cc] !== null) {
    if (cr === placedR && cc === placedC) break
    count++
    cr -= dr
    cc -= dc
  }
  return count >= 2
}

function resolveBoops(
  bed: Bed,
  pools: Record<Player, Pool>,
  pr: number,
  pc: number,
  placed: Piece
): { bed: Bed; pools: Record<Player, Pool>; events: BoopEvent[] } {
  const nextBed = cloneBed(bed)
  const nextPools = clonePools(pools)
  const events: BoopEvent[] = []

  for (const [dr, dc] of ALL_DIRS) {
    const nr = pr + dr
    const nc = pc + dc
    if (!inBounds(nr, nc)) continue
    const neighbor = nextBed[nr][nc]
    if (!neighbor) continue

    if (placed.kind === "kitten" && neighbor.kind === "cat") continue

    if (isBracedAlongPush(nextBed, nr, nc, dr, dc, pr, pc)) continue

    const tr = nr + dr
    const tc = nc + dc
    const from = { r: nr, c: nc }

    if (!inBounds(tr, tc)) {
      nextBed[nr][nc] = null
      returnPieceToPool(nextPools, neighbor)
      events.push({ from, to: null, piece: neighbor })
      continue
    }

    if (nextBed[tr][tc] !== null) continue

    nextBed[nr][nc] = null
    nextBed[tr][tc] = neighbor
    events.push({ from, to: { r: tr, c: tc }, piece: neighbor })
  }

  return { bed: nextBed, pools: nextPools, events }
}

function lineThrough(
  bed: Bed,
  r: number,
  c: number,
  dr: number,
  dc: number,
  player: Player,
  kindFilter?: PieceKind
): Array<{ r: number; c: number }> {
  const cells: Array<{ r: number; c: number }> = []
  let cr = r
  let cc = c
  while (inBounds(cr, cc)) {
    const cell = bed[cr][cc]
    if (!cell || cell.owner !== player) break
    if (kindFilter && cell.kind !== kindFilter) break
    cells.push({ r: cr, c: cc })
    cr += dr
    cc += dc
  }
  return cells
}

function tripleOnLineIncluding(
  line: Array<{ r: number; c: number }>,
  placed: { r: number; c: number }
): Array<{ r: number; c: number }> | null {
  const idx = line.findIndex((p) => p.r === placed.r && p.c === placed.c)
  if (idx === -1 || line.length < 3) return null
  const start = Math.min(Math.max(0, idx - 2), line.length - 3)
  return line.slice(start, start + 3)
}

/** Prefer a trio through the placed cell; else first row-major triple (UI choice TBD). */
function findGraduationTriple(
  bed: Bed,
  player: Player,
  placed: { r: number; c: number }
): Array<{ r: number; c: number }> | null {
  if (bed[placed.r][placed.c]?.owner === player) {
    for (const [dr, dc] of LINE_DIRS) {
      const forward = lineThrough(bed, placed.r, placed.c, dr, dc, player)
      const backward = lineThrough(
        bed,
        placed.r - dr,
        placed.c - dc,
        -dr,
        -dc,
        player
      )
      const line = [...backward.reverse(), ...forward]
      const triple = tripleOnLineIncluding(line, placed)
      if (triple) return triple
    }
  }

  for (let r = 0; r < BED_SIZE; r++) {
    for (let c = 0; c < BED_SIZE; c++) {
      if (bed[r][c]?.owner !== player) continue
      for (const [dr, dc] of LINE_DIRS) {
        const forward = lineThrough(bed, r, c, dr, dc, player)
        const backward = lineThrough(
          bed,
          r - dr,
          c - dc,
          -dr,
          -dc,
          player
        )
        const line = [...backward.reverse(), ...forward]
        if (line.length >= 3) return line.slice(0, 3)
      }
    }
  }
  return null
}

export function findWinningCatLine(
  bed: Bed,
  player: Player
): Array<{ r: number; c: number }> | null {
  for (let r = 0; r < BED_SIZE; r++) {
    for (let c = 0; c < BED_SIZE; c++) {
      if (bed[r][c]?.owner !== player || bed[r][c]?.kind !== "cat") continue
      for (const [dr, dc] of LINE_DIRS) {
        const forward = lineThrough(bed, r, c, dr, dc, player, "cat")
        const backward = lineThrough(
          bed,
          r - dr,
          c - dc,
          -dr,
          -dc,
          player,
          "cat"
        )
        const line = [...backward.reverse(), ...forward]
        if (line.length >= 3) return line.slice(0, 3)
      }
    }
  }
  return null
}

function graduateTriple(
  bed: Bed,
  pools: Record<Player, Pool>,
  player: Player,
  triple: Array<{ r: number; c: number }>
): Bed {
  const next = cloneBed(bed)
  for (const { r, c } of triple) {
    const piece = next[r][c]
    if (!piece) continue
    next[r][c] = null
    if (piece.kind === "kitten") {
      if (pools[player].reserveCats > 0) {
        pools[player].reserveCats -= 1
        pools[player].cats += 1
      }
    } else {
      pools[player].cats += 1
    }
  }
  return next
}

function applyGraduation(
  bed: Bed,
  pools: Record<Player, Pool>,
  player: Player,
  placed: { r: number; c: number }
): Bed {
  const triple = findGraduationTriple(bed, player, placed)
  const tripleIsAllCats =
    triple?.every(({ r, c }) => bed[r][c]?.kind === "cat") ?? false
  if (triple && !tripleIsAllCats) {
    return graduateTriple(bed, pools, player, triple)
  }

  if (
    hasThreeCatsInRow(bed, player) ||
    countCatsOnBed(bed, player) >= 8
  ) {
    return bed
  }

  if (
    countPiecesOnBed(bed, player) === 8 &&
    countCatsOnBed(bed, player) < 8
  ) {
    for (let r = 0; r < BED_SIZE; r++) {
      for (let c = 0; c < BED_SIZE; c++) {
        const piece = bed[r][c]
        if (piece?.owner !== player || piece.kind !== "kitten") continue
        const next = cloneBed(bed)
        next[r][c] = null
        if (pools[player].reserveCats > 0) {
          pools[player].reserveCats -= 1
          pools[player].cats += 1
        }
        return next
      }
    }
    for (let r = 0; r < BED_SIZE; r++) {
      for (let c = 0; c < BED_SIZE; c++) {
        const piece = bed[r][c]
        if (piece?.owner !== player || piece.kind !== "cat") continue
        const next = cloneBed(bed)
        next[r][c] = null
        pools[player].cats += 1
        return next
      }
    }
  }

  return bed
}

function hasThreeCatsInRow(bed: Bed, player: Player): boolean {
  return findWinningCatLine(bed, player) !== null
}

export function listLegalPlaces(state: BoopGameState): Array<{
  row: number
  col: number
  kind: PieceKind
}> {
  if (state.status.kind !== "playing") return []
  const player = state.status.toMove
  const pool = state.pools[player]
  const moves: Array<{ row: number; col: number; kind: PieceKind }> = []
  for (let r = 0; r < BED_SIZE; r++) {
    for (let c = 0; c < BED_SIZE; c++) {
      if (state.bed[r][c] !== null) continue
      if (pool.kittens > 0)
        moves.push({ row: r, col: c, kind: "kitten" })
      if (pool.cats > 0) moves.push({ row: r, col: c, kind: "cat" })
    }
  }
  return moves
}

export function placePiece(
  state: BoopGameState,
  row: number,
  col: number,
  kind: PieceKind
): BoopGameState {
  if (state.status.kind !== "playing") return state
  if (!inBounds(row, col)) return state
  if (state.bed[row][col] !== null) return state

  const player = state.status.toMove
  const pool = state.pools[player]
  if (kind === "kitten" && pool.kittens <= 0) return state
  if (kind === "cat" && pool.cats <= 0) return state

  const pools = clonePools(state.pools)
  if (kind === "kitten") pools[player].kittens -= 1
  else pools[player].cats -= 1

  const bed = cloneBed(state.bed)
  const placed: Piece = { owner: player, kind }
  bed[row][col] = placed

  const booped = resolveBoops(bed, pools, row, col, placed)
  const nextBed = applyGraduation(booped.bed, booped.pools, player, {
    r: row,
    c: col,
  })

  const catLine = findWinningCatLine(nextBed, player)
  if (catLine || countCatsOnBed(nextBed, player) >= 8) {
    return {
      bed: nextBed,
      pools: booped.pools,
      status: { kind: "won", winner: player },
      lastBoops: booped.events,
      winningLine: catLine ?? undefined,
    }
  }

  return {
    bed: nextBed,
    pools: booped.pools,
    status: { kind: "playing", toMove: opponent(player) },
    lastBoops: booped.events,
    winningLine: undefined,
  }
}

export function createGameFromFixture(partial: {
  bed: Bed
  pools: Record<Player, Pool>
  toMove: Player
}): BoopGameState {
  return {
    bed: partial.bed.map((row) => row.slice()),
    pools: {
      black: { ...partial.pools.black },
      white: { ...partial.pools.white },
    },
    status: { kind: "playing", toMove: partial.toMove },
    lastBoops: [],
  }
}

export function createGame(): BoopGameState {
  return createGameFromFixture({
    bed: cloneBed(
      Array.from({ length: BED_SIZE }, () =>
        Array.from({ length: BED_SIZE }, () => null)
      )
    ),
    pools: {
      black: initialPool(),
      white: initialPool(),
    },
    toMove: "black",
  })
}
