import type { BoardState, Color, PieceKind } from "./types";

export const OUTSIDE_ROWS = 6;
export const RESERVE_STACK_SIZE = 7;

export function cellIndex(
  size: number,
  row: number,
  col: number,
): number | null {
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    !Number.isInteger(row) ||
    !Number.isInteger(col)
  )
    return null;
  if (
    row < -OUTSIDE_ROWS ||
    col < -OUTSIDE_ROWS ||
    row >= size + OUTSIDE_ROWS ||
    col >= size + OUTSIDE_ROWS
  )
    return null;
  if (row >= 0 && row < size && col >= 0 && col < size) return row * size + col;
  const width = size + OUTSIDE_ROWS * 2;
  let exterior: number;
  if (row < 0) exterior = (row + OUTSIDE_ROWS) * width + col + OUTSIDE_ROWS;
  else if (row < size)
    exterior =
      OUTSIDE_ROWS * width +
      row * OUTSIDE_ROWS * 2 +
      (col < 0 ? col + OUTSIDE_ROWS : OUTSIDE_ROWS + col - size);
  else
    exterior =
      OUTSIDE_ROWS * width +
      size * OUTSIDE_ROWS * 2 +
      (row - size) * width +
      col +
      OUTSIDE_ROWS;
  return size * size + exterior;
}

export function reserveSupply(size: number): {
  stone: number;
  capstone: number;
} {
  switch (size) {
    case 4:
      return { stone: 15, capstone: 0 };
    case 5:
      return { stone: 21, capstone: 1 };
    case 6:
      return { stone: 30, capstone: 1 };
    case 7:
      return { stone: 40, capstone: 2 };
    case 8:
      return { stone: 50, capstone: 2 };
    default:
      return { stone: 10, capstone: 0 };
  }
}

function reservePileCounts(
  state: BoardState,
  color: Color,
  kind: PieceKind,
): number[] {
  if (state.reserveCounts) return [...state.reserveCounts[color][kind]];
  const total = reserveSupply(state.size)[kind];
  const pileSize = kind === "stone" ? RESERVE_STACK_SIZE : 1;
  const counts = Array.from({ length: Math.ceil(total / pileSize) }, (_, i) =>
    Math.min(pileSize, total - i * pileSize),
  );
  let unassigned = 0;
  for (const stack of state.cells)
    for (const piece of stack) {
      if (piece.color !== color || piece.kind !== kind) continue;
      const pile = piece.reservePile;
      if (
        pile !== undefined &&
        Number.isInteger(pile) &&
        pile >= 0 &&
        pile < counts.length &&
        counts[pile]! > 0
      )
        counts[pile] = counts[pile]! - 1;
      else unassigned += 1;
    }
  for (let i = 0; i < counts.length && unassigned > 0; i++) {
    const used = Math.min(counts[i]!, unassigned);
    counts[i] = counts[i]! - used;
    unassigned -= used;
  }
  return counts;
}

function inventory(
  state: BoardState,
): NonNullable<BoardState["reserveCounts"]> {
  return {
    ivory: {
      stone: reservePileCounts(state, "ivory", "stone"),
      capstone: reservePileCounts(state, "ivory", "capstone"),
    },
    charcoal: {
      stone: reservePileCounts(state, "charcoal", "stone"),
      capstone: reservePileCounts(state, "charcoal", "capstone"),
    },
  };
}

export function createState(size = 5): BoardState {
  if (!Number.isInteger(size) || size < 1)
    throw new RangeError("Board size must be a positive integer");
  return { size, cells: Array.from({ length: size * size }, () => []) };
}

/** Physical inventory in exterior cells (official Tak piece counts). */
export function createSandboxState(size = 5): BoardState {
  const state = createState(size);
  state.cells = Array.from({ length: (size + OUTSIDE_ROWS * 2) ** 2 }, () => []);
  const supply = reserveSupply(size);
  const stonePiles = Math.ceil(supply.stone / RESERVE_STACK_SIZE);
  const rows = Math.ceil(stonePiles / 2);
  const startRow = Math.floor((size - rows) / 2);
  for (const color of ["ivory", "charcoal"] as const) {
    for (const kind of ["stone", "capstone"] as const) {
      const pileSize = kind === "stone" ? RESERVE_STACK_SIZE : 1;
      for (let pile = 0; pile < Math.ceil(supply[kind] / pileSize); pile++) {
        const column = kind === "stone" ? Math.floor(pile / rows) : 0;
        const row = startRow + (kind === "stone" ? pile % rows : rows + pile);
        const col = color === "ivory" ? -2 - column : size + 1 + column;
        const index = cellIndex(size, row, col)!;
        state.cells[index] = Array.from(
          { length: Math.min(pileSize, supply[kind] - pile * pileSize) },
          (_, offset) => ({
            id: `${color}-${kind}-${pile * pileSize + offset + 1}`,
            color,
            kind,
            orientation: "flat" as const,
          }),
        );
      }
    }
  }
  state.reserveCounts = inventory(state);
  return state;
}
