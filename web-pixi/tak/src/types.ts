export type Color = "ivory" | "charcoal";
export type PieceKind = "stone" | "capstone";
export type Orientation = "flat" | "standing";
export interface Piece {
  id: string;
  color: Color;
  kind: PieceKind;
  orientation: Orientation;
  reservePile?: number;
}
export interface BoardState {
  size: number;
  cells: Piece[][];
  reserveCounts?: Record<Color, Record<PieceKind, number[]>>;
}
