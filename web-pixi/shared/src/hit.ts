/** Snap a world point to nearest grid intersection (Gomoku-style). */
export function nearestIntersection(
  worldX: number,
  worldY: number,
  cellSize: number,
  boardSize: number,
): { col: number; row: number } | null {
  const col = Math.round(worldX / cellSize + (boardSize - 1) / 2);
  const row = Math.round(worldY / cellSize + (boardSize - 1) / 2);
  if (col < 0 || col >= boardSize || row < 0 || row >= boardSize) return null;
  return { col, row };
}

/** Map world point to cell index for square grids (Tak/Boop). */
export function nearestCell(
  worldX: number,
  worldY: number,
  cellSize: number,
  boardSize: number,
): { col: number; row: number } | null {
  const col = Math.floor(worldX / cellSize + boardSize / 2);
  const row = Math.floor(worldY / cellSize + boardSize / 2);
  if (col < 0 || col >= boardSize || row < 0 || row >= boardSize) return null;
  return { col, row };
}

export function cellIndex(col: number, row: number, boardSize: number): number {
  return row * boardSize + col;
}
