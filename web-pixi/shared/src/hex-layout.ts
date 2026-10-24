export type Coord = { x: number; y: number };

export type HexLayout = "yinsh" | "tzaar";

export function coordKey(c: Coord): string {
  return `${c.x},${c.y}`;
}

export function screenPoint(
  c: Coord,
  spacing: number,
  layout: HexLayout,
): { x: number; y: number } {
  if (layout === "yinsh") {
    return {
      x: spacing * (0.5 * Math.sqrt(3) * c.x),
      y: spacing * (-c.y + 0.5 * c.x),
    };
  }
  return {
    x: (c.x - c.y * 0.5) * spacing,
    y: -c.y * spacing * 0.866,
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

export function boardOrigin(
  coords: Coord[],
  spacing: number,
  layout: HexLayout,
): { x: number; y: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of coords) {
    const p = screenPoint(c, spacing, layout);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { x: -(minX + maxX) / 2, y: -(minY + maxY) / 2 };
}

export const DEFAULT_PICK_RADIUS_FACTOR = 0.42;

export function nearestCoord(
  worldX: number,
  worldY: number,
  spacing: number,
  coords: Coord[],
  layout: HexLayout,
  pickRadiusFactor = DEFAULT_PICK_RADIUS_FACTOR,
): { coord: Coord; dist: number } | null {
  if (coords.length === 0) return null;
  let best = coords[0];
  let bestD = Infinity;
  for (const c of coords) {
    const p = screenPoint(c, spacing, layout);
    const d = Math.hypot(p.x - worldX, p.y - worldY);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (bestD > spacing * pickRadiusFactor) return null;
  return { coord: best, dist: bestD };
}
