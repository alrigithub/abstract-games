import type * as THREE from 'three';

export type PlayerId = string;

export interface EnginePiece {
  id: string;
  player: PlayerId;
  /** Game-specific shape key, e.g. `flat`, `standing`, `capstone`, `stone`, `cat`, `kitten`. */
  shape: string;
  /** Optional extra fields (orientation, kind, reserve pile, …). */
  data?: Record<string, unknown>;
}

export interface ReserveSlot {
  id: string;
  player: PlayerId;
  shape: string;
  pile: number;
  position: { x: number; z: number };
  count: number;
}

export interface BoardSnapshot {
  /** Number of playable cells (first indices). Extra sandbox cells may follow. */
  playableCells: number;
  cellCount: number;
  cells: EnginePiece[][];
  reserves?: ReserveSlot[];
}

export interface Point {
  x: number;
  y: number;
}

export interface Selection {
  source: number | ReservePick;
  count: number;
}

export interface ReservePick {
  slotId: string;
  player: PlayerId;
  shape: string;
  pile: number;
}

export interface InteractionView {
  selection: Selection | null;
  dragging: boolean;
  pointer: Point | null;
  origin: Point | null;
  target: number | null;
  progress: number;
}

export interface PieceGeometrySet {
  /** Returns world-space height for stacking. */
  height(piece: EnginePiece): number;
  geometry(piece: EnginePiece): THREE.BufferGeometry;
  /** Stable yaw for visual variety. */
  yaw(id: string): number;
  /** EdgesGeometry threshold angle (degrees). */
  edgeThreshold?: number;
  /** Optional stack Y tweak (e.g. marker seated inside a ring). */
  verticalOffset?(piece: EnginePiece, stackIndex: number, stack: EnginePiece[]): number;
}

export interface YinshCoord {
  x: number;
  y: number;
}

export interface BoardBuildContext {
  board: THREE.Group;
  boardMaterial: THREE.MeshBasicMaterial;
  gridMaterial: THREE.MeshBasicMaterial;
  boardGeometries: THREE.BufferGeometry[];
  gridSize: number;
}

export interface Topology {
  /** World XZ center of a cell index. */
  cellPosition(index: number, snapshot: BoardSnapshot): THREE.Vector3;
  /** Map ray/plane hit to cell index, or null. */
  cellAtWorld(x: number, z: number, snapshot: BoardSnapshot): number | null;
  /** Screen-space cell center for accessibility overlays. */
  projectCell(index: number, snapshot: BoardSnapshot): THREE.Vector3;
  /** Custom board mesh/lines; return true to skip the default square slab grid. */
  buildBoard?(ctx: BoardBuildContext): boolean;
  /** Extra world points for camera framing (e.g. hex boards, exterior piles, side racks). */
  frameCorners?(snapshot: BoardSnapshot): THREE.Vector3[];
}

export interface ReserveLayout {
  slots(snapshot: BoardSnapshot): ReserveSlot[];
  slotAt(clientX: number, clientY: number, snapshot: BoardSnapshot): ReserveSlot | undefined;
  resolvePick(snapshot: BoardSnapshot, pick: ReservePick): ReservePick | null;
  remaining(snapshot: BoardSnapshot, pick: ReservePick): number;
}

export interface GameRules {
  /** Whether a stack suffix may be picked from `source`. */
  canPick(snapshot: BoardSnapshot, source: number, count: number): boolean;
  /** Whether dropping `selection` onto `target` is allowed (engine may still animate invalid as bounce). */
  canDrop(snapshot: BoardSnapshot, selection: Selection, target: number): boolean;
  /** Highlight targets while dragging; omit to allow any cell. */
  legalTargets?(snapshot: BoardSnapshot, selection: Selection): number[] | null;
  /** Apply a committed drop; returns next snapshot. */
  applyDrop(snapshot: BoardSnapshot, selection: Selection, target: number): BoardSnapshot;
  /** Flip / toggle top piece when supported (Tak flat/wall). */
  toggleTop?(snapshot: BoardSnapshot, source: number): BoardSnapshot | null;
}

export interface SceneApi {
  setSnapshot(snapshot: BoardSnapshot): void;
  setInteraction(view: InteractionView): void;
  setTheme(theme: ThemeId): void;
  setCameraMode(mode: 'pan' | 'orbit'): void;
  hitTest(clientX: number, clientY: number): number | null;
  hitReserve(clientX: number, clientY: number): ReservePick | null;
  reserveScreen(pick: ReservePick): Point;
  cellScreen(index: number): Point;
  /** Queue AI / remote moves through the same animation path. */
  enqueueAnimation(task: () => Promise<void>): void;
  /** Animate a flippable piece (Yinsh marker, Tak flat/standing stone). */
  flipPiece(pieceId: string): Promise<void>;
  flipPieces(pieceIds: string[], staggerMs?: number): Promise<void>;
  dispose(): void;
}

export interface InteractionOptions {
  element: HTMLElement;
  getSnapshot(): BoardSnapshot;
  hitTest(x: number, y: number): number | null;
  hitReserve?(x: number, y: number): ReservePick | null;
  getHoldInterval?(): number;
  /** Max stack suffix that press-and-hold may grow (defaults to full stack / reserve count). */
  getPickHeight?(cell: number, snapshot: BoardSnapshot): number;
  onView(view: InteractionView): void;
  onCommit(selection: Selection, target: number): void;
  onReserveCommit?(selection: Selection, target: ReservePick): void;
  canInteract?(): boolean;
}

export interface InteractionApi {
  selectReserve(pick: ReservePick): void;
  startReserve(event: PointerEvent, pick: ReservePick): void;
  activateCell(index: number): void;
  selectCount(count: number): void;
  getSelection(): Selection | null;
  cancel(): void;
  dispose(): void;
}

export type ThemeId = 'light' | 'dark';

export interface ThemeTokens {
  table: string;
  board: string;
  lines: string;
  win: string;
  piece: Record<PlayerId, { fill: string; rim: string; edge: string }>;
  ghostOpacity: number;
  shadow: string;
}
