/** Port of `crates/tzaar` rules (minimal TS for web-3d tap play). */

export type Player = 'A' | 'B';
export type PieceKind = 'tzaar' | 'tzarra' | 'tott';

export interface Piece {
  player: Player;
  kind: PieceKind;
}

export interface Coord {
  x: number;
  y: number;
}

export type Move =
  | { tag: 'Action'; from: Coord; to: Coord }
  | { tag: 'PassSecond' };

export type TurnPhase = 'WhiteOpening' | 'ForcedCapture' | 'OptionalSecond';

const TEMPLATE: number[] = [
  -1, 1, 1, 1, 1, 100, 100, 100, 100, -1, -2, 2, 2, 2, -1, 100, 100, 100, -1, -2, -3, 3, 3, -2, -1, 100, 100, -1,
  -2, -3, -1, 1, -3, -2, -1, 100, 1, 2, 3, 1, 100, -1, -3, -2, -1, 100, 1, 2, 3, -1, 1, 3, 2, 1, 100, 100, 1, 2,
  -3, -3, 3, 2, 1, 100, 100, 100, 1, -2, -2, -2, 2, 1, 100, 100, 100, 100, -1, -1, -1, -1, 1,
];

export const DIRECTIONS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

export function coordIndex(c: Coord): number | null {
  if (c.x < 0 || c.x >= 9 || c.y < 0 || c.y >= 9) return null;
  return c.y * 9 + c.x;
}

export function isPlayable(c: Coord): boolean {
  const i = coordIndex(c);
  return i !== null && TEMPLATE[i] !== 100;
}

export function allPlayableCoords(): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const c = { x, y };
      if (isPlayable(c)) out.push(c);
    }
  }
  return out;
}

export function step(c: Coord, [dx, dy]: [number, number]): Coord {
  return { x: c.x + dx, y: c.y + dy };
}

function templatePiece(value: number): Piece {
  const player: Player = value > 0 ? 'A' : 'B';
  const kind: PieceKind = Math.abs(value) === 3 ? 'tzaar' : Math.abs(value) === 2 ? 'tzarra' : 'tott';
  return { player, kind };
}

export class Stack {
  pieces: Piece[];
  constructor(pieces: Piece[]) {
    this.pieces = pieces;
  }
  get height() {
    return this.pieces.length;
  }
  get owner(): Player {
    return this.pieces[0]!.player;
  }
  top(): Piece {
    return this.pieces[this.pieces.length - 1]!;
  }
  mergeOnTop(other: Stack) {
    this.pieces.push(...other.pieces);
  }

  clone(): Stack {
    return new Stack(this.pieces.map(p => ({ ...p })));
  }
}

export class Board {
  private stacks: (Stack | null)[] = Array.from({ length: 81 }, () => null);

  static fixedStart(): Board {
    const b = new Board();
    for (const c of allPlayableCoords()) {
      const idx = coordIndex(c)!;
      b.stacks[idx] = new Stack([templatePiece(TEMPLATE[idx]!)]);
    }
    return b;
  }

  stack(c: Coord): Stack | null {
    const i = coordIndex(c);
    return i === null ? null : this.stacks[i];
  }

  isEmpty(c: Coord) {
    return !this.stack(c);
  }

  removeStack(c: Coord): Stack | null {
    const i = coordIndex(c);
    if (i === null) return null;
    const s = this.stacks[i];
    this.stacks[i] = null;
    return s;
  }

  setStack(c: Coord, stack: Stack) {
    this.stacks[coordIndex(c)!] = stack;
  }

  slideTarget(from: Coord, dir: [number, number]): Coord | null {
    if (!isPlayable(from) || this.isEmpty(from)) return null;
    let current = from;
    for (;;) {
      const next = step(current, dir);
      if (!isPlayable(next)) return null;
      if (!this.isEmpty(next)) return next;
      current = next;
    }
  }

  captureTargets(from: Coord, player: Player): Coord[] {
    const attacker = this.stack(from);
    if (!attacker || attacker.owner !== player) return [];
    const height = attacker.height;
    const targets: Coord[] = [];
    for (const dir of DIRECTIONS) {
      const to = this.slideTarget(from, dir);
      if (!to) continue;
      const defender = this.stack(to);
      if (!defender || defender.owner === player) continue;
      if (height >= defender.height) targets.push(to);
    }
    return targets;
  }

  stackTargets(from: Coord, player: Player): Coord[] {
    const attacker = this.stack(from);
    if (!attacker || attacker.owner !== player) return [];
    const targets: Coord[] = [];
    for (const dir of DIRECTIONS) {
      const to = this.slideTarget(from, dir);
      if (!to) continue;
      const target = this.stack(to);
      if (target && target.owner === player) targets.push(to);
    }
    return targets;
  }

  visibleTypes(player: Player): [boolean, boolean, boolean] {
    const present: [boolean, boolean, boolean] = [false, false, false];
    for (const c of allPlayableCoords()) {
      const s = this.stack(c);
      if (!s || s.owner !== player) continue;
      const idx = s.top().kind === 'tzaar' ? 0 : s.top().kind === 'tzarra' ? 1 : 2;
      present[idx] = true;
    }
    return present;
  }

  clone(): Board {
    const b = new Board();
    b.stacks = this.stacks.map(s => (s ? s.clone() : null));
    return b;
  }
}

export class GameState {
  board = Board.fixedStart();
  toMove: Player = 'A';
  phase: TurnPhase = 'WhiteOpening';
  winner: Player | null = null;

  legalMoves(): Move[] {
    if (this.winner) return [];
    if (this.phase === 'WhiteOpening') return this.openingCaptures();
    if (this.phase === 'ForcedCapture') return this.forcedCaptures();
    return this.optionalSecondMoves();
  }

  private occupied(player: Player): Coord[] {
    return allPlayableCoords().filter(c => this.board.stack(c)?.owner === player);
  }

  private openingCaptures(): Move[] {
    const moves: Move[] = [];
    for (const from of this.occupied('A')) {
      for (const to of this.board.captureTargets(from, 'A')) {
        if (isAdjacent(from, to)) moves.push({ tag: 'Action', from, to });
      }
    }
    return moves;
  }

  private forcedCaptures(): Move[] {
    const moves: Move[] = [];
    for (const from of this.occupied(this.toMove)) {
      for (const to of this.board.captureTargets(from, this.toMove)) {
        moves.push({ tag: 'Action', from, to });
      }
    }
    return moves;
  }

  private optionalSecondMoves(): Move[] {
    const moves: Move[] = [];
    for (const from of this.occupied(this.toMove)) {
      for (const to of this.board.captureTargets(from, this.toMove)) moves.push({ tag: 'Action', from, to });
      for (const to of this.board.stackTargets(from, this.toMove)) moves.push({ tag: 'Action', from, to });
    }
    moves.push({ tag: 'PassSecond' });
    return moves;
  }

  clone(): GameState {
    const next = new GameState();
    next.board = this.board.clone();
    next.toMove = this.toMove;
    next.phase = this.phase;
    next.winner = this.winner;
    return next;
  }

  apply(move: Move): boolean {
    if (this.winner) return false;
    if (this.phase === 'WhiteOpening' && move.tag === 'Action') {
      if (this.toMove !== 'A' || !isAdjacent(move.from, move.to)) return false;
      if (!this.applyCapture(move.from, move.to, 'A')) return false;
      this.checkTypeWin();
      if (!this.winner) {
        this.toMove = 'B';
        this.phase = 'ForcedCapture';
        this.checkNoCaptureLoss();
      }
      return true;
    }
    if (this.phase === 'ForcedCapture' && move.tag === 'Action') {
      if (!this.isLegalCapture(move.from, move.to, this.toMove)) return false;
      if (!this.applyCapture(move.from, move.to, this.toMove)) return false;
      this.checkTypeWin();
      if (!this.winner) this.phase = 'OptionalSecond';
      return true;
    }
    if (this.phase === 'OptionalSecond' && move.tag === 'PassSecond') {
      this.endTurn();
      return true;
    }
    if (this.phase === 'OptionalSecond' && move.tag === 'Action') {
      if (this.isLegalCapture(move.from, move.to, this.toMove)) {
        if (!this.applyCapture(move.from, move.to, this.toMove)) return false;
      } else if (this.isLegalStack(move.from, move.to, this.toMove)) {
        if (!this.applyStack(move.from, move.to)) return false;
      } else return false;
      this.checkTypeWin();
      if (!this.winner) this.endTurn();
      return true;
    }
    return false;
  }

  private isLegalCapture(from: Coord, to: Coord, player: Player) {
    return this.board.captureTargets(from, player).some(t => t.x === to.x && t.y === to.y);
  }

  private isLegalStack(from: Coord, to: Coord, player: Player) {
    return this.board.stackTargets(from, player).some(t => t.x === to.x && t.y === to.y);
  }

  private applyCapture(from: Coord, to: Coord, player: Player): boolean {
    if (!this.isLegalCapture(from, to, player)) return false;
    const moving = this.board.removeStack(from);
    if (!moving || moving.owner !== player) return false;
    this.board.removeStack(to);
    this.board.setStack(to, moving);
    return true;
  }

  private applyStack(from: Coord, to: Coord): boolean {
    const moving = this.board.removeStack(from);
    const target = this.board.stack(to);
    if (!moving || !target) return false;
    if (!this.isLegalStack(from, to, moving.owner)) return false;
    target.mergeOnTop(moving);
    return true;
  }

  private endTurn() {
    this.toMove = this.toMove === 'A' ? 'B' : 'A';
    this.phase = 'ForcedCapture';
    this.checkNoCaptureLoss();
  }

  private checkTypeWin() {
    for (const player of ['A', 'B'] as const) {
      const types = this.board.visibleTypes(player);
      if (types.some(p => !p)) {
        this.winner = player === 'A' ? 'B' : 'A';
        return;
      }
    }
  }

  private checkNoCaptureLoss() {
    if (this.winner || this.phase !== 'ForcedCapture') return;
    if (this.forcedCaptures().length === 0) this.winner = this.toMove === 'A' ? 'B' : 'A';
  }
}

function isAdjacent(a: Coord, b: Coord): boolean {
  return DIRECTIONS.some(dir => {
    const s = step(a, dir);
    return s.x === b.x && s.y === b.y;
  });
}

export function coordKey(c: Coord) {
  return `${c.x},${c.y}`;
}

export function moveEquals(a: Move, b: Move) {
  if (a.tag !== b.tag) return false;
  if (a.tag === 'PassSecond') return true;
  if (a.tag === 'Action' && b.tag === 'Action') {
    return a.from.x === b.from.x && a.from.y === b.from.y && a.to.x === b.to.x && a.to.y === b.to.y;
  }
  return false;
}
