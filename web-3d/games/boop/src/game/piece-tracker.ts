import type { BoardSnapshot, EnginePiece } from '@abstract/three-engine';
import { cellIndex } from '@abstract/three-engine';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import { defaultRestingCell, resolveRestingCell } from './boop-resting-slot';
import {
  handSlotStartIndex,
  poolOccupiedCells,
  poolSlots,
  HAND_COLUMN,
  type PoolCounts,
} from './boop-pool-layout';
import type { GameView, PieceKind, PlayerId } from './types';

interface RestingPiece {
  id: string;
  player: PlayerId;
  kind: PieceKind;
  row: number;
  col: number;
}

export interface PlacementSource {
  id: string;
  from: 'pool' | 'resting';
  restRow?: number;
  restCol?: number;
}

/** Stable piece ids for 3D tweening across boops, pool, and off-board rests. */
export class PieceTracker {
  private board = new Map<string, string>();
  private poolStacks: Record<PlayerId, Record<'kitten' | 'cat', string[]>> = {
    A: { kitten: [], cat: [] },
    B: { kitten: [], cat: [] },
  };
  private resting: RestingPiece[] = [];
  private seq = 0;
  private lastView?: GameView;

  private key(x: number, y: number) {
    return `${x},${y}`;
  }

  private mint(prefix: string) {
    return `${prefix}-${this.seq++}`;
  }

  restingCount() {
    return this.resting.length;
  }

  resetFromNewGame() {
    this.board.clear();
    this.resting = [];
    this.poolStacks = { A: { kitten: [], cat: [] }, B: { kitten: [], cat: [] } };
    for (const player of ['A', 'B'] as const) {
      for (let i = 0; i < 8; i++) this.poolStacks[player].kitten.push(this.mint(`pool-${player}-k`));
    }
  }

  /** Exterior cell for a booped-off piece in the owner's off-board column. */
  static restingCell(
    from: { x: number; y: number },
    push: { push_x: number; push_y: number },
    player: PlayerId,
  ) {
    return defaultRestingCell(from, push, player);
  }

  private blockedPoolCells(view: GameView): { row: number; col: number }[] {
    const blocked: { row: number; col: number }[] = [];
    for (const player of ['A', 'B'] as const) {
      const pool = view.pools[player === 'A' ? 0 : 1]!;
      blocked.push(...poolOccupiedCells(player, pool));
    }
    return blocked;
  }

  resolveRestingSlot(
    from: { x: number; y: number },
    push: { push_x: number; push_y: number },
    player: PlayerId,
  ): { row: number; col: number } {
    const blocked = this.lastView ? this.blockedPoolCells(this.lastView) : [];
    return resolveRestingCell(from, push, this.resting, player, blocked);
  }

  addResting(id: string, player: PlayerId, kind: PieceKind, row: number, col: number) {
    this.resting.push({ id, player, kind, row, col });
  }

  addRestingFromBoop(
    id: string,
    player: PlayerId,
    kind: PieceKind,
    from: { x: number; y: number },
    push: { push_x: number; push_y: number },
  ) {
    const { row, col } = this.resolveRestingSlot(from, push, player);
    this.addResting(id, player, kind, row, col);
  }

  removeRestingById(id: string) {
    this.resting = this.resting.filter(r => r.id !== id);
  }

  takeForPlacement(player: PlayerId, kind: PieceKind, preferredId?: string): PlacementSource | null {
    if (preferredId) {
      for (let i = this.resting.length - 1; i >= 0; i--) {
        const r = this.resting[i]!;
        if (r.id === preferredId) {
          this.resting.splice(i, 1);
          return { id: r.id, from: 'resting', restRow: r.row, restCol: r.col };
        }
      }
      for (const poolKind of ['kitten', 'cat'] as const) {
        const stack = this.poolStacks[player][poolKind];
        const idx = stack.indexOf(preferredId);
        if (idx >= 0) {
          stack.splice(idx, 1);
          return { id: preferredId, from: 'pool' };
        }
      }
    }
    for (let i = this.resting.length - 1; i >= 0; i--) {
      const r = this.resting[i]!;
      if (r.player === player && r.kind === kind) {
        this.resting.splice(i, 1);
        return { id: r.id, from: 'resting', restRow: r.row, restCol: r.col };
      }
    }
    const id = this.poolStacks[player][kind].pop();
    return id ? { id, from: 'pool' } : null;
  }

  private restingCountFor(player: PlayerId, kind: PieceKind) {
    return this.resting.filter(r => r.player === player && r.kind === kind).length;
  }

  syncBoard(view: GameView) {
    this.lastView = view;
    for (let y = 0; y < BOOP_GRID; y++) {
      for (let x = 0; x < BOOP_GRID; x++) {
        const cell = view.board[y]?.[x];
        const k = this.key(x, y);
        if (!cell) {
          this.board.delete(k);
          continue;
        }
        let id = this.board.get(k);
        if (!id) id = this.mint(`b-${x}-${y}`);
        this.board.set(k, id);
      }
    }
    for (const player of ['A', 'B'] as const) {
      const pool = view.pools[player === 'A' ? 0 : 1]!;
      this.resizePool(player, 'kitten', pool.kittens_in_hand);
      this.resizePool(player, 'cat', pool.cats_in_hand);
    }
  }

  private resizePool(player: PlayerId, kind: PieceKind, inHand: number) {
    const stack = this.poolStacks[player][kind];
    const visible = Math.max(0, inHand - this.restingCountFor(player, kind));
    while (stack.length < visible) stack.push(this.mint(`pool-${player}-${kind}`));
    while (stack.length > visible) stack.pop();
  }

  moveBoardId(from: { x: number; y: number }, to: { x: number; y: number }) {
    const fk = this.key(from.x, from.y);
    const tk = this.key(to.x, to.y);
    const id = this.board.get(fk);
    if (!id) return;
    this.board.delete(fk);
    this.board.set(tk, id);
  }

  placeOnBoard(x: number, y: number, id: string) {
    this.board.set(this.key(x, y), id);
  }

  removeFromBoard(x: number, y: number): string | null {
    const k = this.key(x, y);
    const id = this.board.get(k) ?? null;
    this.board.delete(k);
    return id;
  }

  ensureIdAt(x: number, y: number, player: PlayerId, kind: PieceKind): string {
    const k = this.key(x, y);
    const existing = this.board.get(k);
    if (existing) return existing;
    const id = this.mint(`b-${x}-${y}-${player}-${kind}`);
    this.board.set(k, id);
    return id;
  }

  private pushHandPoolPieces(
    cells: EnginePiece[][],
    player: PlayerId,
    pool: PoolCounts,
  ) {
    const slots = poolSlots(player, HAND_COLUMN);
    const catStart = handSlotStartIndex('cat', pool);
    const kittenStart = handSlotStartIndex('kitten', pool);
    this.poolStacks[player].cat.forEach((id, i) => {
      const slot = slots[catStart + i];
      if (!slot) return;
      const idx = cellIndex(BOOP_GRID, slot.row, slot.col, BOOP_OUTSIDE);
      if (idx === null) return;
      cells[idx]!.push({ id, player, shape: 'cat' });
    });
    this.poolStacks[player].kitten.forEach((id, i) => {
      const slot = slots[kittenStart + i];
      if (!slot) return;
      const idx = cellIndex(BOOP_GRID, slot.row, slot.col, BOOP_OUTSIDE);
      if (idx === null) return;
      cells[idx]!.push({ id, player, shape: 'kitten' });
    });
  }

  buildSnapshot(view: GameView): BoardSnapshot {
    this.lastView = view;
    const cellTotal = (BOOP_GRID + BOOP_OUTSIDE * 2) ** 2;
    const cells: EnginePiece[][] = Array.from({ length: cellTotal }, () => []);

    for (let y = 0; y < BOOP_GRID; y++) {
      for (let x = 0; x < BOOP_GRID; x++) {
        const piece = view.board[y]?.[x];
        if (!piece) continue;
        const id = this.board.get(this.key(x, y)) ?? this.mint('orphan');
        const idx = cellIndex(BOOP_GRID, y, x, BOOP_OUTSIDE);
        if (idx === null) continue;
        cells[idx]!.push({ id, player: piece.player, shape: piece.kind });
      }
    }

    for (const player of ['A', 'B'] as const) {
      const pool = view.pools[player === 'A' ? 0 : 1]!;
      this.pushHandPoolPieces(cells, player, pool);
    }

    const restGroups = new Map<string, RestingPiece[]>();
    for (const r of this.resting) {
      const k = `${r.row},${r.col}`;
      const list = restGroups.get(k) ?? [];
      list.push(r);
      restGroups.set(k, list);
    }
    for (const group of restGroups.values()) {
      group.forEach((r, stackIndex) => {
        const idx = cellIndex(BOOP_GRID, r.row, r.col, BOOP_OUTSIDE);
        if (idx === null) return;
        cells[idx]!.push({ id: r.id, player: r.player, shape: r.kind, data: { restStack: stackIndex } });
      });
    }

    return { playableCells: BOOP_GRID * BOOP_GRID, cellCount: cellTotal, cells };
  }
}
