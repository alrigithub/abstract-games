import { Graphics } from "pixi.js";
import {
  type Coord,
  type HexLayout,
  screenPoint,
} from "./hex-layout";
import { theme } from "./theme";

const GRID_LINE_DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, -1],
];

function step(coord: Coord, dx: number, dy: number): Coord {
  return { x: coord.x + dx, y: coord.y + dy };
}

function coordSet(coords: Coord[]): Set<string> {
  return new Set(coords.map((c) => `${c.x},${c.y}`));
}

/** Draw board fill + hex intersection grid (Yinsh: full line families; Tzaar: segment grid). */
export function drawHexBoard(
  g: Graphics,
  coords: Coord[],
  spacing: number,
  factor: number,
  layout: HexLayout,
  mode: "yinsh" | "tzaar",
) {
  const pts = coords.map((c) => screenPoint(c, spacing, layout));

  if (pts.length > 2) {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const pad = spacing * 0.55;
    g.roundRect(
      minX - pad,
      minY - pad,
      maxX - minX + pad * 2,
      maxY - minY + pad * 2,
      8,
    ).fill({ color: theme.boardFill });
  }

  const lineW = 1.2 * factor;
  if (mode === "yinsh") {
    for (let x = -5; x <= 5; x++) {
      const row = coords.filter((c) => c.x === x);
      if (row.length < 2) continue;
      row.sort((a, b) => a.y - b.y);
      const a = screenPoint(row[0], spacing, layout);
      const b = screenPoint(row[row.length - 1], spacing, layout);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: lineW, color: theme.boardLine });
    }
    for (let y = -5; y <= 5; y++) {
      const row = coords.filter((c) => c.y === y);
      if (row.length < 2) continue;
      row.sort((a, b) => a.x - b.x);
      const a = screenPoint(row[0], spacing, layout);
      const b = screenPoint(row[row.length - 1], spacing, layout);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: lineW, color: theme.boardLine });
    }
    for (let d = -5; d <= 5; d++) {
      const row = coords.filter((c) => c.y === c.x + d);
      if (row.length < 2) continue;
      row.sort((a, b) => a.x - b.x);
      const a = screenPoint(row[0], spacing, layout);
      const b = screenPoint(row[row.length - 1], spacing, layout);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: lineW, color: theme.boardLine });
    }
  } else {
    const playable = coordSet(coords);
    const isPlayable = (c: Coord) => playable.has(`${c.x},${c.y}`);
    for (const [dx, dy] of GRID_LINE_DIRS) {
      const back = [-dx, -dy] as const;
      for (const coord of coords) {
        if (isPlayable(step(coord, back[0], back[1]))) continue;
        let current = coord;
        while (isPlayable(current)) {
          const next = step(current, dx, dy);
          if (!isPlayable(next)) break;
          const a = screenPoint(current, spacing, layout);
          const b = screenPoint(next, spacing, layout);
          g.moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .stroke({ width: lineW, color: theme.boardLine });
          current = next;
        }
      }
    }
  }

  for (const c of coords) {
    const p = screenPoint(c, spacing, layout);
    g.circle(p.x, p.y, 2.2 * factor).fill({ color: theme.boardLine, alpha: 0.55 });
  }
}
