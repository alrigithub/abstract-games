import type { BoardSnapshot, EnginePiece } from '@abstract/three-engine';
import { cellIndex } from '@abstract/three-engine';
import type { GameView, PieceKind, PlayerId } from './types';

const GRID = 6;
const OUTSIDE = 2;

/** Stable piece ids for 3D tweening across boops and pool transfers. */
export class PieceTracker {
  private board = new Map<string, string>();
  private poolStacks: Record<PlayerId, Record<PieceKind, string[]>> = {
    A: { kitten: [], cat: [] },
    B: { kitten: [], cat: [] },
  };
  private seq = 0;

  private key(x: number, y: number) {
    return `${x},${y}`;
  }

  private mint(prefix: string) {
    return `${prefix}-${this.seq++}`;
  }

  resetFromNewGame() {
    this.board.clear();
    this.poolStacks = { A: { kitten: [], cat: [] }, B: { kitten: [], cat: [] } };
    for (const player of ['A', 'B'] as const) {
      for (let i = 0; i < 8; i++) this.poolStacks[player].kitten.push(this.mint(`pool-${player}-k`));
      for (let i = 0; i < 8; i++) this.poolStacks[player].cat.push(this.mint(`pool-${player}-c-reserve`));
    }
  }

  /** Reconcile ids with authoritative rules view (after animations). */
  syncBoard(view: GameView) {
    const seen = new Set<string>();
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const cell = view.board[y]?.[x];
        const k = this.key(x, y);
        if (!cell) {
          this.board.delete(k);
          continue;
        }
        let id = this.board.get(k);
        if (!id) id = this.mint(`b-${x}-${y}`);
        this.board.set(k, id);
        seen.add(id);
      }
    }
    for (const player of ['A', 'B'] as const) {
      const pool = view.pools[player === 'A' ? 0 : 1]!;
      this.resizePool(player, 'kitten', pool.kittens_in_hand);
      this.resizePool(player, 'cat', pool.cats_in_hand);
    }
  }

  private resizePool(player: PlayerId, kind: PieceKind, count: number) {
    const stack = this.poolStacks[player][kind];
    while (stack.length < count) stack.push(this.mint(`pool-${player}-${kind}`));
    while (stack.length > count) stack.pop();
  }

  takeFromPool(player: PlayerId, kind: PieceKind): string | null {
    const stack = this.poolStacks[player][kind];
    return stack.pop() ?? null;
  }

  returnToPool(player: PlayerId, kind: PieceKind, id: string) {
    this.poolStacks[player][kind].push(id);
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

  buildSnapshot(view: GameView): BoardSnapshot {
    const cellTotal = (GRID + OUTSIDE * 2) ** 2;
    const cells: EnginePiece[][] = Array.from({ length: cellTotal }, () => []);

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const piece = view.board[y]?.[x];
        if (!piece) continue;
        const id = this.board.get(this.key(x, y)) ?? this.mint('orphan');
        const idx = cellIndex(GRID, y, x, OUTSIDE);
        if (idx === null) continue;
        cells[idx]!.push({ id, player: piece.player, shape: piece.kind });
      }
    }

    const leftCol = -2;
    const rightCol = GRID + 1;
    const pushPool = (row: number, col: number, player: PlayerId, kind: PieceKind) => {
      const idx = cellIndex(GRID, row, col, OUTSIDE);
      if (idx === null) return;
      for (const id of this.poolStacks[player][kind]) {
        cells[idx]!.push({ id, player, shape: kind });
      }
    };

    pushPool(3, leftCol, 'A', 'kitten');
    pushPool(3, rightCol, 'B', 'kitten');
    pushPool(5, leftCol, 'A', 'cat');
    pushPool(5, rightCol, 'B', 'cat');

    return { playableCells: GRID * GRID, cellCount: cellTotal, cells };
  }
}
