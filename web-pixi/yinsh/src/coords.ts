import {
  coordKey as sharedCoordKey,
  nearestCoord as sharedNearest,
  screenPoint as sharedScreenPoint,
  spacingForViewport,
  type Coord,
} from "@abstract/pixi-shared";

export type { Coord };

export function isInsideBoard(c: Coord): boolean {
  const sqrt3 = Math.sqrt(3);
  const x = c.x;
  const y = c.y;
  const BOARD_RADIUS_SQ = 4.6 * 4.6;
  return (
    Math.pow(0.5 * sqrt3 * x, 2) + Math.pow(0.5 * x - y, 2) <= BOARD_RADIUS_SQ
  );
}

export function allCoords(): Coord[] {
  const coords: Coord[] = [];
  for (let x = -5; x <= 5; x++) {
    for (let y = -5; y <= 5; y++) {
      const coord = { x, y };
      if (isInsideBoard(coord)) coords.push(coord);
    }
  }
  return coords;
}

export function coordKey(c: Coord): string {
  return sharedCoordKey(c);
}

export function parseCoordKey(k: string): Coord {
  const [x, y] = k.split(",").map(Number);
  return { x, y };
}

export function screenPoint(c: Coord, spacing: number): { x: number; y: number } {
  return sharedScreenPoint(c, spacing, "yinsh");
}

export { spacingForViewport };

export function rackSlotPosition(
  player: "A" | "B",
  slot: number,
  spacing: number,
  halfWidth: number,
  factor: number,
): { x: number; y: number } {
  const sideX = halfWidth - 31 * factor;
  const step = spacing * 0.7;
  const baseY = step;
  if (player === "A") {
    return { x: -sideX, y: baseY - slot * step };
  }
  return { x: sideX, y: baseY - slot * step };
}

export const BOARD_PICK_RADIUS_FACTOR = 0.42;

export function nearestCoord(
  worldX: number,
  worldY: number,
  spacing: number,
): { coord: Coord; dist: number } {
  const hit = sharedNearest(
    worldX,
    worldY,
    spacing,
    allCoords(),
    "yinsh",
    BOARD_PICK_RADIUS_FACTOR,
  );
  if (!hit) {
    return { coord: allCoords()[0], dist: Infinity };
  }
  return hit;
}
