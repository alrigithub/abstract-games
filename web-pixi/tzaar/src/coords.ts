import {
  boardOrigin,
  coordKey,
  nearestCoord as sharedNearest,
  screenPoint as sharedScreenPoint,
  spacingForViewport,
  type Coord,
} from "@abstract/pixi-shared";

export type { Coord };
export { coordKey, spacingForViewport, boardOrigin };

/** Official fixed-start template (`100` = hole). */
const TEMPLATE = [
  -1, 1, 1, 1, 1, 100, 100, 100, 100, -1, -2, 2, 2, 2, -1, 100, 100, 100, -1, -2, -3, 3, 3,
  -2, -1, 100, 100, -1, -2, -3, -1, 1, -3, -2, -1, 100, 1, 2, 3, 1, 100, -1, -3, -2, -1, 100,
  1, 2, 3, -1, 1, 3, 2, 1, 100, 100, 1, 2, -3, -3, 3, 2, 1, 100, 100, 100, 1, -2, -2, -2, 2, 1,
  100, 100, 100, 100, -1, -1, -1, -1, 1,
];

export function isPlayable(c: Coord): boolean {
  if (c.x < 0 || c.x >= 9 || c.y < 0 || c.y >= 9) return false;
  return TEMPLATE[c.y * 9 + c.x] !== 100;
}

export function allPlayableCoords(): Coord[] {
  const coords: Coord[] = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const c = { x, y };
      if (isPlayable(c)) coords.push(c);
    }
  }
  return coords;
}

export function screenPoint(c: Coord, spacing: number): { x: number; y: number } {
  return sharedScreenPoint(c, spacing, "tzaar");
}

export const BOARD_PICK_RADIUS_FACTOR = 0.42;

export function nearestPlayable(
  worldX: number,
  worldY: number,
  spacing: number,
): Coord | null {
  const hit = sharedNearest(
    worldX,
    worldY,
    spacing,
    allPlayableCoords(),
    "tzaar",
    BOARD_PICK_RADIUS_FACTOR,
  );
  return hit?.coord ?? null;
}

export function stackIndex(c: Coord): number {
  return c.y * 9 + c.x;
}
