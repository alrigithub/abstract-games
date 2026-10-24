import { YINSH_COORDS, isYinshPlayfieldCoord, type YinshCoord } from '@abstract/three-engine';

export interface Coord {
  x: number;
  y: number;
}

export function coordEq(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function coordKey(c: Coord): string {
  return `${c.x},${c.y}`;
}

export function coordNew(x: number, y: number): Coord {
  return { x, y };
}

export function isInsideBoard(coord: Coord): boolean {
  return isYinshPlayfieldCoord(coord as YinshCoord);
}

export function isOnSameLineAs(a: Coord, b: Coord): boolean {
  return a.x === b.x || a.y === b.y || a.x - a.y === b.x - b.y;
}

function shorten(delta: Coord): Coord {
  return {
    x: Math.max(-1, Math.min(1, delta.x)),
    y: Math.max(-1, Math.min(1, delta.y)),
  };
}

export function coordAdd(a: Coord, b: Coord): Coord {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function coordSub(a: Coord, b: Coord): Coord {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function coordMul(c: Coord, n: number): Coord {
  return { x: c.x * n, y: c.y * n };
}

export function between(a: Coord, b: Coord): Coord[] {
  const coords: Coord[] = [];
  const delta = shorten(coordSub(b, a));
  let current = coordAdd(a, delta);
  while (!coordEq(current, b)) {
    coords.push(current);
    current = coordAdd(current, delta);
  }
  return coords;
}

export function coordNorm(c: Coord): number {
  return Math.sqrt(c.x ** 2 + c.y ** 2);
}

export function allCoords(): Coord[] {
  return YINSH_COORDS.map(c => coordNew(c.x, c.y));
}

export enum Direction {
  N,
  NE,
  SE,
  S,
  SW,
  NW,
}

export function directionVector(d: Direction): Coord {
  switch (d) {
    case Direction.N:
      return { x: -1, y: 0 };
    case Direction.S:
      return { x: 1, y: 0 };
    case Direction.NE:
      return { x: -1, y: -1 };
    case Direction.SW:
      return { x: 1, y: 1 };
    case Direction.NW:
      return { x: 0, y: 1 };
    case Direction.SE:
      return { x: 0, y: -1 };
  }
}

export const DIRECTIONS: Direction[] = [
  Direction.N,
  Direction.NE,
  Direction.SE,
  Direction.S,
  Direction.SW,
  Direction.NW,
];

export const AXES: Direction[] = [Direction.N, Direction.NE, Direction.NW];
