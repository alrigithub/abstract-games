import type { BoardState, Color, Piece, PieceKind, Reserve, Selection } from './types';

export const HOLD_INTERVAL = 400;
export const RESERVE_STACK_SIZE = 7;
export const OUTSIDE_ROWS = 6;

/** Board indices stay first; exterior cells follow in padded row-major order. */
export function cellIndex(size: number, row: number, col: number): number | null {
  if (!Number.isInteger(size) || size < 1 || !Number.isInteger(row) || !Number.isInteger(col)) return null;
  if (row < -OUTSIDE_ROWS || col < -OUTSIDE_ROWS || row >= size + OUTSIDE_ROWS || col >= size + OUTSIDE_ROWS) return null;
  if (row >= 0 && row < size && col >= 0 && col < size) return row * size + col;
  const width = size + OUTSIDE_ROWS * 2;
  let exterior: number;
  if (row < 0) exterior = (row + OUTSIDE_ROWS) * width + col + OUTSIDE_ROWS;
  else if (row < size) exterior = OUTSIDE_ROWS * width + row * OUTSIDE_ROWS * 2 + (col < 0 ? col + OUTSIDE_ROWS : OUTSIDE_ROWS + col - size);
  else exterior = OUTSIDE_ROWS * width + size * OUTSIDE_ROWS * 2 + (row - size) * width + col + OUTSIDE_ROWS;
  return size * size + exterior;
}

export function cellCoordinates(size: number, index: number): { row: number; col: number } {
  const width = size + OUTSIDE_ROWS * 2;
  if (!Number.isInteger(size) || size < 1 || !Number.isInteger(index) || index < 0 || index >= width * width) throw new RangeError('Invalid sandbox cell');
  if (index < size * size) return { row: Math.floor(index / size), col: index % size };
  let exterior = index - size * size;
  if (exterior < OUTSIDE_ROWS * width) return { row: Math.floor(exterior / width) - OUTSIDE_ROWS, col: exterior % width - OUTSIDE_ROWS };
  exterior -= OUTSIDE_ROWS * width;
  if (exterior < size * OUTSIDE_ROWS * 2) {
    const offset = exterior % (OUTSIDE_ROWS * 2);
    return { row: Math.floor(exterior / (OUTSIDE_ROWS * 2)), col: offset < OUTSIDE_ROWS ? offset - OUTSIDE_ROWS : size + offset - OUTSIDE_ROWS };
  }
  exterior -= size * OUTSIDE_ROWS * 2;
  return { row: size + Math.floor(exterior / width), col: exterior % width - OUTSIDE_ROWS };
}

export function reserveSupply(size: number): { stone: number; capstone: number } {
  switch (size) {
    case 4: return { stone: 15, capstone: 0 };
    case 5: return { stone: 21, capstone: 1 };
    case 6: return { stone: 30, capstone: 1 };
    case 7: return { stone: 40, capstone: 2 };
    case 8: return { stone: 50, capstone: 2 };
    default: return { stone: 10, capstone: 0 };
  }
}

export function reservePileCounts(state: BoardState, color: Color, kind: PieceKind): number[] {
  if (state.reserveCounts) return [...state.reserveCounts[color][kind]];
  const total = reserveSupply(state.size)[kind];
  const pileSize = kind === 'stone' ? RESERVE_STACK_SIZE : 1;
  const counts = Array.from({ length: Math.ceil(total / pileSize) }, (_, i) => Math.min(pileSize, total - i * pileSize));
  let unassigned = 0;
  for (const stack of state.cells) for (const piece of stack) {
    if (piece.color !== color || piece.kind !== kind) continue;
    const pile = piece.reservePile;
    if (pile !== undefined && Number.isInteger(pile) && pile >= 0 && pile < counts.length && counts[pile]! > 0) counts[pile] = counts[pile]! - 1;
    else unassigned += 1;
  }
  // Imported arrangements predate physical pile IDs. Assign their usage after
  // explicit pile usage, so the result does not depend on board traversal order.
  for (let i = 0; i < counts.length && unassigned > 0; i++) {
    const used = Math.min(counts[i]!, unassigned);
    counts[i] = counts[i]! - used;
    unassigned -= used;
  }
  return counts;
}

export function reserveRemaining(state: BoardState, reserve: Reserve): number {
  const counts = reservePileCounts(state, reserve.color, reserve.kind);
  return reserve.pile === undefined ? counts.reduce((sum, count) => sum + count, 0) : counts[reserve.pile] ?? 0;
}

function inventory(state: BoardState): NonNullable<BoardState['reserveCounts']> {
  return {
    ivory: { stone: reservePileCounts(state, 'ivory', 'stone'), capstone: reservePileCounts(state, 'ivory', 'capstone') },
    charcoal: { stone: reservePileCounts(state, 'charcoal', 'stone'), capstone: reservePileCounts(state, 'charcoal', 'capstone') },
  };
}

export function resolveReserve(state: BoardState, reserve: Reserve): Reserve | null {
  const counts = reservePileCounts(state, reserve.color, reserve.kind);
  const pile = reserve.pile ?? counts.findIndex(count => count > 0);
  return Number.isInteger(pile) && pile >= 0 && (counts[pile] ?? 0) > 0 ? { ...reserve, pile } : null;
}

export function countSelected(elapsedMs: number, height: number, interval = HOLD_INTERVAL): number {
  const duration = Number.isFinite(interval) && interval > 0 ? interval : HOLD_INTERVAL;
  return Math.max(0, Math.min(height, 1 + Math.floor(Math.max(0, elapsedMs) / duration)));
}

export function createState(size = 5): BoardState {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('Board size must be a positive integer');
  return { size, cells: Array.from({ length: size * size }, () => []) };
}

/** A physical sandbox contains its entire inventory in ordinary exterior cells. */
export function createSandboxState(size = 5): BoardState {
  const state = createState(size);
  state.cells = Array.from({ length: (size + OUTSIDE_ROWS * 2) ** 2 }, () => []);
  const supply = reserveSupply(size);
  const stonePiles = Math.ceil(supply.stone / RESERVE_STACK_SIZE);
  const rows = Math.ceil(stonePiles / 2);
  const startRow = Math.floor((size - rows) / 2);
  for (const color of ['ivory', 'charcoal'] as const) {
    for (const kind of ['stone', 'capstone'] as const) {
      const pileSize = kind === 'stone' ? RESERVE_STACK_SIZE : 1;
      for (let pile = 0; pile < Math.ceil(supply[kind] / pileSize); pile++) {
        const column = kind === 'stone' ? Math.floor(pile / rows) : 0;
        const row = startRow + (kind === 'stone' ? pile % rows : rows + pile);
        const col = color === 'ivory' ? -2 - column : size + 1 + column;
        const index = cellIndex(size, row, col)!;
        state.cells[index] = Array.from({ length: Math.min(pileSize, supply[kind] - pile * pileSize) }, (_, offset) => ({
          id: `${color}-${kind}-${pile * pileSize + offset + 1}`, color, kind, orientation: 'flat',
        }));
      }
    }
  }
  state.reserveCounts = inventory(state);
  return state;
}

function validCell(state: BoardState, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < state.cells.length;
}

/** Moves the selected top suffix as one stack, preserving bottom-to-top order. */
export function moveSelection(state: BoardState, selection: Selection, target: number): BoardState {
  if (!validCell(state, target)) return state;
  const destination = state.cells[target]!;
  if (typeof selection.source === 'number') {
    const source = selection.source;
    if (!validCell(state, source) || source === target) return state;
    const stack = state.cells[source]!;
    const count = Math.min(stack.length, Math.max(0, Math.floor(selection.count)));
    if (!count || !Number.isFinite(count)) return state;
    const cells = state.cells.slice();
    cells[source] = stack.slice(0, stack.length - count);
    cells[target] = [...destination, ...stack.slice(-count)];
    return { ...state, cells };
  }
  const reserve = resolveReserve(state, selection.source);
  if (!reserve) return state;
  const count = Math.min(reserveRemaining(state, reserve), Math.max(0, Math.floor(selection.count)));
  if (!count || !Number.isFinite(count)) return state;
  const ids = new Set(state.cells.flat().map(piece => piece.id));
  let nextId = 1;
  const pieces: Piece[] = Array.from({ length: count }, () => {
    while (ids.has(`reserve-${nextId}`)) nextId += 1;
    const id = `reserve-${nextId++}`;
    ids.add(id);
    return { id, color: reserve.color, kind: reserve.kind, orientation: reserve.orientation, reservePile: reserve.pile };
  });
  const cells = state.cells.slice();
  cells[target] = [...destination, ...pieces];
  if (!state.reserveCounts) return { ...state, cells };
  const reserveCounts = inventory(state);
  reserveCounts[reserve.color][reserve.kind][reserve.pile!]! -= count;
  return { ...state, cells, reserveCounts };
}

export function rotateSelection(state: BoardState, selection: Selection): BoardState {
  if (typeof selection.source !== 'number' || selection.count !== 1 || !validCell(state, selection.source)) return state;
  const stack = state.cells[selection.source]!;
  const top = stack.at(-1);
  if (!top || top.kind !== 'stone') return state;
  const cells = state.cells.slice();
  cells[selection.source] = [...stack.slice(0, -1), { ...top, orientation: top.orientation === 'flat' ? 'standing' : 'flat' }];
  return { ...state, cells };
}

/** Returns a matching top suffix to the finite inventory. */
export function returnSelectionToReserve(state: BoardState, selection: Selection, reserve: Reserve): BoardState {
  const reserveCounts = inventory(state);
  const targetCounts = reserveCounts[reserve.color][reserve.kind];
  const pile = reserve.pile ?? 0;
  if (!Number.isInteger(pile) || pile < 0 || pile >= targetCounts.length) return state;
  if (typeof selection.source !== 'number') {
    const source = resolveReserve(state, selection.source);
    if (!source || source.color !== reserve.color || source.kind !== reserve.kind || source.pile === pile) return state;
    const count = Math.min(reserveRemaining(state, source), Math.max(0, Math.floor(selection.count)));
    if (!count || !Number.isFinite(count)) return state;
    targetCounts[source.pile!]! -= count;
    targetCounts[pile]! += count;
    return { ...state, reserveCounts };
  }
  if (!validCell(state, selection.source)) return state;
  const stack = state.cells[selection.source]!;
  const count = Math.min(stack.length, Math.max(0, Math.floor(selection.count)));
  if (!count || !Number.isFinite(count)) return state;
  const returned = stack.slice(-count);
  if (returned.some(piece => piece.color !== reserve.color || piece.kind !== reserve.kind)) return state;
  const cells = state.cells.slice();
  cells[selection.source] = stack.slice(0, stack.length - count);
  targetCounts[pile]! += count;
  return { ...state, cells, reserveCounts };
}
