import { describe, expect, it } from "vitest"
import { chooseMove } from "./choose-move"
import {
  adjudicate,
  applyMove,
  createGame,
  flatCounts,
  hasRoad,
  isLegalMove,
  legalMoves,
  reservePieces,
  winnerScore,
  type GameState,
} from "./engine"
import { decodeState, encodeState } from "./snapshot";
import type { Color, Piece } from "./types";
let id = 0
const stone = (
  color: Color,
  orientation: "flat" | "standing" = "flat"
): Piece => ({ id: `test-${id++}`, color, kind: "stone", orientation })
const cap = (color: Color): Piece => ({ ...stone(color), kind: "capstone" })
const position = (size = 5): GameState => ({ ...createGame(size), ply: 2 })
describe("official Tak", () => {
  it("chooseMove returns within node budget after opening flat", () => {
    let game = createGame()
    game = applyMove(game, {
      type: "place",
      to: 12,
      kind: "stone",
      orientation: "flat",
    })
    const t0 = performance.now()
    const move = chooseMove(game, { maxDepth: 2, maxNodes: 1800 })
    expect(performance.now() - t0).toBeLessThan(8000)
    expect(move).not.toBeNull()
  })

  it("uses fixed physical inventory and swapped opening flats", () => {
    const initial = createGame()
    expect(reservePieces(initial, "ivory")).toHaveLength(22)
    expect(legalMoves(initial)).toHaveLength(25)
    expect(
      isLegalMove(initial, {
        type: "place",
        to: 0,
        kind: "stone",
        orientation: "standing",
      })
    ).toBe(false)
    const next = applyMove(initial, {
      type: "place",
      to: 0,
      kind: "stone",
      orientation: "flat",
    })
    expect(next.board.cells[0]![0]!.color).toBe("charcoal")
    expect(initial.board.cells[0]).toEqual([])
    expect(next.board.cells.flat()).toHaveLength(
      initial.board.cells.flat().length
    )
    const third = applyMove(next, {
      type: "place",
      to: 1,
      kind: "stone",
      orientation: "flat",
    })
    expect(third.board.cells[1]![0]!.color).toBe("ivory")
    expect(third.toMove).toBe("ivory")
  })
  it("spreads bottom first and respects ownership, carry and board edges", () => {
    const game = position(3)
    game.board.cells[0] = [
      stone("charcoal"),
      stone("ivory"),
      stone("charcoal"),
      stone("ivory"),
    ]
    const move = {
      type: "spread",
      from: 0,
      direction: "east",
      drops: [1, 2],
    } as const
    const next = applyMove(game, { ...move, drops: [...move.drops] })
    expect(next.board.cells[0]).toHaveLength(1)
    expect(next.board.cells[1]![0]!.color).toBe("ivory")
    expect(next.board.cells[2]!.map((p) => p.color)).toEqual([
      "charcoal",
      "ivory",
    ])
    expect(isLegalMove(game, { ...move, drops: [4] })).toBe(false)
    expect(isLegalMove(game, { ...move, drops: [1, 1, 1] })).toBe(false)
    expect(
      isLegalMove({ ...game, toMove: "charcoal" }, { ...move, drops: [1] })
    ).toBe(false)
  })
  it("only flattens a wall with the final lone capstone", () => {
    const game = position()
    game.board.cells[0] = [stone("ivory"), cap("ivory")]
    game.board.cells[2] = [stone("charcoal", "standing")]
    const move = {
      type: "spread",
      from: 0,
      direction: "east",
      drops: [1, 1],
    } as const
    expect(isLegalMove(game, { ...move, drops: [...move.drops] })).toBe(true)
    const next = applyMove(game, { ...move, drops: [...move.drops] })
    expect(next.board.cells[2]![0]!.orientation).toBe("flat")
    game.board.cells[1] = [stone("ivory", "standing")]
    expect(isLegalMove(game, { ...move, drops: [2] })).toBe(false)
    game.board.cells[1] = [cap("charcoal")]
    expect(isLegalMove(game, { ...move, drops: [1] })).toBe(false)
  })
  it("recognizes bent roads and awards a double road to the mover", () => {
    const game = position(3)
    for (const i of [0, 1, 4, 7]) game.board.cells[i] = [stone("ivory")]
    expect(hasRoad(game.board, "ivory")).toBe(true)
    game.board.cells[4] = [stone("ivory", "standing")]
    expect(hasRoad(game.board, "ivory")).toBe(false)
    for (const i of [0, 1, 2]) game.board.cells[i] = [stone("ivory")]
    for (const i of [6, 7, 8]) game.board.cells[i] = [stone("charcoal")]
    expect(adjudicate(game, "charcoal")?.winner).toBe("charcoal")
  })
  it("excludes buried flats, walls and caps from flat scoring; full ties draw", () => {
    const game = position(3)
    for (let i = 0; i < 9; i++)
      game.board.cells[i] = [
        stone("ivory"),
        stone(i % 2 ? "ivory" : "charcoal", "standing"),
      ]
    game.board.cells[0] = [cap("ivory")]
    expect(flatCounts(game.board)).toEqual({ ivory: 0, charcoal: 0 })
    expect(adjudicate(game, "ivory")).toMatchObject({
      winner: null,
      reason: "flats",
    })
    game.board.cells[1] = [stone("ivory")]
    game.result = adjudicate(game, "ivory")
    expect(game.result?.winner).toBe("ivory")
    expect(winnerScore(game)).toBe(19)
  })
  it("ends on exhausted combined reserve, with roads taking priority", () => {
    const game = position(3)
    for (let i = 9; i < game.board.cells.length; i++)
      game.board.cells[i] = game.board.cells[i]!.filter(
        (p) => p.color !== "ivory"
      )
    game.board.cells[0] = [stone("ivory")]
    expect(adjudicate(game, "charcoal")).toMatchObject({
      reason: "flats",
      winner: "ivory",
    })
    game.board.cells[1] = [stone("ivory")]
    game.board.cells[2] = [stone("ivory")]
    expect(adjudicate(game, "ivory")?.reason).toBe("road")
  })
  it("generates only legal moves", () => {
    const game = position(3)
    game.board.cells[0] = [stone("ivory")]
    game.board.cells[1] = [stone("ivory")]
    expect(legalMoves(game).every((move) => isLegalMove(game, move))).toBe(true)
  })
  it("rejects malformed runtime moves, gaps, zero drops, opening spreads and edge wrapping", () => {
    const game = position(3)
    game.board.cells[2] = [stone("ivory"), stone("ivory")]
    for (const move of [
      null,
      {},
      { type: "spread", from: 2 },
      { type: "spread", from: 2, direction: "east", drops: [1] },
      { type: "spread", from: 2, direction: "south", drops: [0, 2] },
      { type: "spread", from: 2, direction: "south", drops: [-1, 2] },
      { type: "spread", from: 2, direction: "diagonal", drops: [1] },
    ])
      expect(isLegalMove(game, move as never)).toBe(false)
    const opening = { ...game, ply: 0 }
    expect(
      isLegalMove(opening, {
        type: "spread",
        from: 2,
        direction: "south",
        drops: [1],
      })
    ).toBe(false)
    expect(
      isLegalMove(createGame(), {
        type: "place",
        to: 0,
        kind: "capstone",
        orientation: "flat",
      })
    ).toBe(false)
  })
  it("crushes walls of either color with a lone cap and awards an opponent-only road", () => {
    for (const color of ["ivory", "charcoal"] as const) {
      const game = position()
      game.board.cells[0] = [cap("ivory")]
      game.board.cells[1] = [stone(color, "standing")]
      expect(
        applyMove(game, {
          type: "spread",
          from: 0,
          direction: "east",
          drops: [1],
        }).board.cells[1]![0]!.orientation
      ).toBe("flat")
    }
    const game = position(3)
    for (const i of [0, 1, 2]) game.board.cells[i] = [stone("charcoal")]
    expect(adjudicate(game, "ivory")?.winner).toBe("charcoal")
  })
  it("remaining capstone prevents supply exhaustion and finished games offer no moves", () => {
    const game = position()
    for (let i = 25; i < game.board.cells.length; i++)
      game.board.cells[i] = game.board.cells[i]!.filter(
        (p) => p.color !== "ivory" || p.kind === "capstone"
      )
    expect(adjudicate(game, "ivory")).toBeNull()
    for (let i = 25; i < game.board.cells.length; i++)
      game.board.cells[i] = game.board.cells[i]!.filter(
        (p) => p.color !== "ivory"
      )
    game.result = adjudicate(game, "ivory")
    expect(game.result).toMatchObject({ reason: "flats", winner: null })
    expect(legalMoves(game)).toEqual([])
  })
  it("preserves complete inventory and wire roundtrips through a played sequence", () => {
    let game = createGame()
    const identities = game.board.cells
      .flat()
      .map((p) => p.id)
      .sort()
    for (let turn = 0; turn < 12 && !game.result; turn++) {
      const moves = legalMoves(game)
      game = applyMove(game, moves[(turn * 17) % moves.length]!)
      const restored = decodeState(encodeState(game.board))
      expect(restored.cells).toEqual(game.board.cells)
      expect(
        game.board.cells
          .flat()
          .map((p) => p.id)
          .sort()
      ).toEqual(identities)
    }
  })
})
