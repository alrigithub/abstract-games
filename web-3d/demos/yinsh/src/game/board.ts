import {
  allCoords,
  AXES,
  between,
  coordAdd,
  coordEq,
  coordMul,
  coordNew,
  DIRECTIONS,
  directionVector,
  isInsideBoard,
  type Coord,
} from './coord';
import { flipPlayer, type Player } from './player';

type Element = { kind: 'ring'; player: Player } | { kind: 'marker'; player: Player } | { kind: 'empty' };

const EMPTY: Element = { kind: 'empty' };

export interface CheckRunResult {
  aHasRun: boolean;
  bHasRun: boolean;
}

export function checkRunResultNoRuns(r: CheckRunResult): boolean {
  return !r.aHasRun && !r.bHasRun;
}

export function checkRunResultHasRun(r: CheckRunResult, player: Player): boolean {
  return player === 'A' ? r.aHasRun : r.bHasRun;
}

function emptyGrid(): Element[][] {
  return Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => EMPTY));
}

export class Board {
  private board: Element[][] = emptyGrid();
  ringsA: Coord[] = [];
  ringsB: Coord[] = [];
  markersA: Coord[] = [];
  markersB: Coord[] = [];

  static empty(): Board {
    return new Board();
  }

  private elementAtUnchecked(coord: Coord): Element {
    return this.board[coord.y + 5]![coord.x + 5]!;
  }

  private elementAt(coord: Coord): Element {
    if (isInsideBoard(coord)) {
      return this.elementAtUnchecked(coord);
    }
    return EMPTY;
  }

  private elementAtMutUnchecked(coord: Coord): Element {
    return this.board[coord.y + 5]![coord.x + 5]!;
  }

  private insertBoardElementAt(coord: Coord, element: Element): void {
    this.board[coord.y + 5]![coord.x + 5]! = element;
  }

  private removeBoardElementAt(coord: Coord): void {
    this.board[coord.y + 5]![coord.x + 5]! = EMPTY;
  }

  isFree(coord: Coord): boolean {
    return this.elementAt(coord).kind === 'empty';
  }

  hasRingAt(coord: Coord, player: Player): boolean {
    const el = this.elementAt(coord);
    return el.kind === 'ring' && el.player === player;
  }

  hasMarkerAt(coord: Coord): boolean {
    return this.elementAt(coord).kind === 'marker';
  }

  elementColorAt(coord: Coord): Player | undefined {
    const el = this.elementAt(coord);
    if (el.kind === 'ring' || el.kind === 'marker') {
      return el.player;
    }
    return undefined;
  }

  addRing(player: Player, coord: Coord): void {
    this.insertBoardElementAt(coord, { kind: 'ring', player });
    if (player === 'A') {
      this.ringsA.push(coord);
    } else {
      this.ringsB.push(coord);
    }
  }

  removeRing(coord: Coord): void {
    this.removeBoardElementAt(coord);
    this.ringsA = this.ringsA.filter(c => !coordEq(c, coord));
    this.ringsB = this.ringsB.filter(c => !coordEq(c, coord));
  }

  numRings(): number {
    return this.ringsA.length + this.ringsB.length;
  }

  addMarker(player: Player, coord: Coord): void {
    this.insertBoardElementAt(coord, { kind: 'marker', player });
    if (player === 'A') {
      this.markersA.push(coord);
    } else {
      this.markersB.push(coord);
    }
  }

  removeMarker(coord: Coord): void {
    this.removeBoardElementAt(coord);
    this.markersA = this.markersA.filter(c => !coordEq(c, coord));
    this.markersB = this.markersB.filter(c => !coordEq(c, coord));
  }

  numMarkers(player: Player): number {
    return player === 'A' ? this.markersA.length : this.markersB.length;
  }

  *freeCoords(): Generator<Coord> {
    for (const coord of allCoords()) {
      if (this.isFree(coord)) {
        yield coord;
      }
    }
  }

  *ringCoords(player: Player): Generator<Coord> {
    const list = player === 'A' ? this.ringsA : this.ringsB;
    for (const c of list) {
      yield c;
    }
  }

  *markerCoords(player: Player): Generator<Coord> {
    const list = player === 'A' ? this.markersA : this.markersB;
    for (const c of list) {
      yield c;
    }
  }

  ringMoves(start: Coord): Coord[] {
    const moves: Coord[] = [];

    for (const d of DIRECTIONS) {
      const dir = directionVector(d);
      let current = coordAdd(start, dir);

      while (isInsideBoard(current) && this.isFree(current)) {
        moves.push(current);
        current = coordAdd(current, dir);
      }

      while (this.hasMarkerAt(current) && isInsideBoard(current)) {
        current = coordAdd(current, dir);
      }

      if (isInsideBoard(current) && this.isFree(current)) {
        moves.push(current);
      }
    }

    return moves;
  }

  isValidRingMove(start: Coord, end: Coord): boolean {
    return this.ringMoves(start).some(c => coordEq(c, end));
  }

  private canPlaceMarkerAt(coord: Coord, player: Player): boolean {
    const el = this.elementAt(coord);
    return el.kind === 'ring' && el.player === player && this.ringMoves(coord).length > 0;
  }

  *markerMoves(player: Player): Generator<Coord> {
    for (const c of this.ringCoords(player)) {
      if (this.canPlaceMarkerAt(c, player)) {
        yield c;
      }
    }
  }

  flipMarkersBetween(start: Coord, end: Coord): void {
    for (const coord of between(start, end)) {
      const el = this.elementAtMutUnchecked(coord);
      if (el.kind === 'marker') {
        el.player = flipPlayer(el.player);
        if (el.player === 'A') {
          this.markersA.push(coord);
          this.markersB = this.markersB.filter(c => !coordEq(c, coord));
        } else {
          this.markersB.push(coord);
          this.markersA = this.markersA.filter(c => !coordEq(c, coord));
        }
      }
    }
  }

  runCoordsFrom(start: Coord): Coord[] | undefined {
    const seed = this.elementAt(start);
    if (seed.kind !== 'marker') {
      return undefined;
    }
    const player = seed.player;

    for (const axis of AXES) {
      const dir = directionVector(axis);
      const markersPositive: Coord[] = [];
      for (let i = 1; i <= 4; i++) {
        const c = coordAdd(start, coordMul(dir, i));
        const el = this.elementAt(c);
        if (el.kind === 'marker' && el.player === player) {
          markersPositive.push(c);
        } else {
          break;
        }
      }
      const markersNegative: Coord[] = [];
      for (let i = 1; i <= 4; i++) {
        const c = coordAdd(start, coordMul(dir, -i));
        const el = this.elementAt(c);
        if (el.kind === 'marker' && el.player === player) {
          markersNegative.push(c);
        } else {
          break;
        }
      }

      const interleaved: Coord[] = [start];
      const n = Math.max(markersPositive.length, markersNegative.length);
      for (let i = 0; i < n && interleaved.length < 5; i++) {
        if (i < markersPositive.length) {
          interleaved.push(markersPositive[i]!);
        }
        if (interleaved.length < 5 && i < markersNegative.length) {
          interleaved.push(markersNegative[i]!);
        }
      }

      if (interleaved.length === 5) {
        return interleaved;
      }
    }

    return undefined;
  }

  checkRun(): CheckRunResult {
    let aHasRun = false;
    let bHasRun = false;
    for (const coord of this.markersA) {
      if (this.runCoordsFrom(coord)) {
        aHasRun = true;
        break;
      }
    }
    for (const coord of this.markersB) {
      if (this.runCoordsFrom(coord)) {
        bHasRun = true;
        break;
      }
    }
    return { aHasRun, bHasRun };
  }

  runCoords(player: Player): Coord[] {
    const runCoords: Coord[] = [];
    for (const coord of this.markerCoords(player)) {
      const coords = this.runCoordsFrom(coord);
      if (coords) {
        runCoords.push(...coords);
      }
    }
    return runCoords;
  }

  runSeeds(player: Player): Coord[] {
    const seenRuns: Coord[][] = [];
    const seeds: Coord[] = [];

    for (const coord of this.markerCoords(player)) {
      const coords = this.runCoordsFrom(coord);
      if (coords) {
        const canonical = [...coords].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
        const duplicate = seenRuns.some(
          seen =>
            seen.length === canonical.length && seen.every((c, i) => coordEq(c, canonical[i]!)),
        );
        if (!duplicate) {
          seenRuns.push(canonical);
          seeds.push(coord);
        }
      }
    }

    return seeds;
  }

  removeRun(seed: Coord): void {
    const runCoords = this.runCoordsFrom(seed);
    if (!runCoords) {
      throw new Error('removeRun called with invalid seed');
    }
    for (const coord of runCoords) {
      this.removeMarker(coord);
    }
  }

  fillBoardFromLists(): void {
    this.board = emptyGrid();
    for (const coord of this.ringsA) {
      this.insertBoardElementAt(coord, { kind: 'ring', player: 'A' });
    }
    for (const coord of this.ringsB) {
      this.insertBoardElementAt(coord, { kind: 'ring', player: 'B' });
    }
    for (const coord of this.markersA) {
      this.insertBoardElementAt(coord, { kind: 'marker', player: 'A' });
    }
    for (const coord of this.markersB) {
      this.insertBoardElementAt(coord, { kind: 'marker', player: 'B' });
    }
  }

  clone(): Board {
    const b = new Board();
    b.ringsA = this.ringsA.map(c => ({ ...c }));
    b.ringsB = this.ringsB.map(c => ({ ...c }));
    b.markersA = this.markersA.map(c => ({ ...c }));
    b.markersB = this.markersB.map(c => ({ ...c }));
    b.fillBoardFromLists();
    return b;
  }
}
