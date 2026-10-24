export type Coord = { x: number; y: number };

const BOARD_RADIUS_SQ = 4.6 * 4.6;

export function isInsideBoard(c: Coord): boolean {
  const sqrt3 = Math.sqrt(3);
  const x = c.x;
  const y = c.y;
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
  return `${c.x},${c.y}`;
}

export function parseCoordKey(k: string): Coord {
  const [x, y] = k.split(",").map(Number);
  return { x, y };
}

/** Same layout as `yinsh_gui` `ScaleFactor::screen_point`. */
export function screenPoint(c: Coord, spacing: number): { x: number; y: number } {
  return {
    x: spacing * (0.5 * Math.sqrt(3) * c.x),
    y: spacing * (-c.y + 0.5 * c.x),
  };
}

export function spacingForViewport(
  width: number,
  height: number,
  base = 80,
): number {
  const scale = Math.min(height / 800, width / 872, 1.5);
  return base * scale;
}

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
  let best = allCoords()[0];
  let bestD = Infinity;
  for (const c of allCoords()) {
    const p = screenPoint(c, spacing);
    const d = Math.hypot(p.x - worldX, p.y - worldY);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { coord: best, dist: bestD };
}
