/** All Yinsh coordinates lie on a hexagonal grid within a circle of radius 4.6. */
const BOARD_RADIUS_SQUARED = 4.6 * 4.6;

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
  const sqrt3 = Math.sqrt(3);
  const x = coord.x;
  const y = coord.y;
  return (0.5 * sqrt3 * x) ** 2 + (0.5 * x - y) ** 2 <= BOARD_RADIUS_SQUARED;
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
  const coords: Coord[] = [];
  for (let x = -5; x <= 5; x++) {
    for (let y = -5; y <= 5; y++) {
      const coord = coordNew(x, y);
      if (isInsideBoard(coord)) {
        coords.push(coord);
      }
    }
  }
  return coords;
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
