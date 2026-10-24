export type Color = 'ivory' | 'charcoal';
export type PieceKind = 'stone' | 'capstone';
export type Orientation = 'flat' | 'standing';
export interface Piece { id: string; color: Color; kind: PieceKind; orientation: Orientation; reservePile?: number }
export interface BoardState { size: number; cells: Piece[][]; reserveCounts?: Record<Color, Record<PieceKind, number[]>> }
export interface Reserve { color: Color; kind: PieceKind; orientation: Orientation; pile?: number }
export interface Selection { source: number | Reserve; count: number }
export interface Point { x: number; y: number }
export interface InteractionView { selection: Selection | null; dragging: boolean; pointer: Point | null; origin: Point | null; target: number | null; progress: number }
export interface SceneApi {
  setState(state: BoardState): void;
  setInteraction(view: InteractionView): void;
  setCameraMode(mode: 'pan' | 'orbit'): void;
  hitTest(clientX: number, clientY: number): number | null;
  hitReserve(clientX: number, clientY: number): Reserve | null;
  reserveScreen(reserve: Reserve): Point;
  cellScreen(index: number): Point;
  dispose(): void;
}
export interface InteractionOptions {
  element: HTMLElement;
  getState(): BoardState;
  hitTest(x: number, y: number): number | null;
  hitReserve?(x: number, y: number): Reserve | null;
  getHoldInterval?(): number;
  onView(view: InteractionView): void;
  onCommit(selection: Selection, target: number): void;
  onReserveCommit?(selection: Selection, target: Reserve): void;
}
export interface InteractionApi {
  selectReserve(reserve: Reserve): void;
  startReserve(event: PointerEvent, reserve: Reserve): void;
  activateCell(index: number): void;
  selectCount(count: number): void;
  getSelection(): Selection | null;
  cancel(): void;
  dispose(): void;
}
