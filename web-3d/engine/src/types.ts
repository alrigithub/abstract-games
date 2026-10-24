import type * as THREE from 'three';
import type { CameraViewController } from './camera-views';

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
  /** Optional GLB / multi-mesh visual; when set, used instead of a single {@link geometry} mesh. */
  createVisual?(piece: EnginePiece): THREE.Object3D;
  /** Swap shape (e.g. Tak flat ↔ wall) on an existing visual root. */
  replaceVisual?(root: THREE.Object3D, piece: EnginePiece): void;
  /** Stable yaw for visual variety. */
  yaw(id: string): number;
  /** EdgesGeometry threshold angle (degrees). */
  edgeThreshold?: number;
  /** Optional stack Y tweak (e.g. marker seated inside a ring). */
  verticalOffset?(piece: EnginePiece, stackIndex: number, stack: EnginePiece[]): number;
  /** When `'base'`, geometry min.y is on the playfield and stack centers are shifted down by half height. */
  geometryOrigin?: 'base' | 'center';
  /** When false, skip inverted-hull outline (e.g. solid Yinsh markers). */
  useOutline?(piece: EnginePiece): boolean;
  /** Override fill material(s); return null to use theme player color. */
  materialFor?(piece: EnginePiece, tokens: ThemeTokens, selected?: boolean): THREE.Material | THREE.Material[] | null;
}

export interface PieceBuildContext {
  tokens: ThemeTokens;
  edgeCache: Map<THREE.BufferGeometry, THREE.EdgesGeometry>;
  edgeMaterial: THREE.LineBasicMaterial;
  outlineMaterial: THREE.MeshBasicMaterial;
  edgeThreshold: number;
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

/** Flat piece silhouette for projected shadows and translucent ghosts. */
export interface AssistFootprint {
  shape: 'ring' | 'disc';
  outerRadius: number;
  innerRadius?: number;
}

/** Soft dark footprint at a future placement (hover or legal spot). */
export interface AssistShadowHint {
  cell: number;
  footprint: AssistFootprint;
  /** `hover` is strongest; `legal` is softened legal-move hint. */
  strength?: 'legal' | 'hover';
}

/** Translucent piece preview at a past or hypothetical position (no lift). */
export interface AssistGhostHint {
  cell: number;
  player: PlayerId;
  ring?: AssistFootprint;
  marker?: { radius: number };
  strength?: 'normal' | 'strong';
}

/** Unlit overlays for legal moves (dots, paths, highlights). */
export interface BoardAssistState {
  destinationCells?: readonly number[];
  pathCells?: readonly number[];
  highlightCells?: readonly number[];
  pickableCells?: readonly number[];
  selectedCell?: number;
  hoverCell?: number;
  lastMove?: {
    fromCell: number;
    toCell: number;
    pathCells?: readonly number[];
    /** Same length as pathCells; XZ overrides per vertex. */
    pathWorld?: readonly { x: number; z: number }[];
    /** When true, skip endpoint dots (use {@link ghosts} at from instead). */
    omitFromEndpoint?: boolean;
    /** When true, skip all endpoint dots. */
    omitEndpointDots?: boolean;
  };
  /** World XZ anchor for the first path vertex (e.g. selected ring centre). */
  pathFromWorld?: { x: number; z: number };
  /** World XZ anchor for the last path vertex. */
  pathToWorld?: { x: number; z: number };
  /** Destination dot radius in world units (~35% of marker radius for Yinsh). */
  destinationDotRadius?: number;
  /** @deprecated Prefer {@link ghosts}. */
  markerGhost?: { cell: number; player: string; radius: number };
  /** Projected piece-shaped shadows (future positions). */
  shadows?: readonly AssistShadowHint[];
  /** Ghosted piece silhouettes (past positions / marker fill previews). */
  ghosts?: readonly AssistGhostHint[];
  /** Warm celebratory halos under the five scoring markers (no path ribbons). */
  runGlows?: readonly AssistRunRowGlow[];
  runGlowStyle?: AssistRunGlowStyle;
  /** Marker preview disc radius for ring-centre ghosts (world units). */
  markerGhostRadius?: number;
  /** World Y for marker preview discs (above playfield, below seated stones). */
  markerGhostSurfaceY?: number;
  /** Ring-removal step: halos under removable rings. */
  ringPickGlows?: readonly AssistRingPickGlow[];
  flipPieceIds?: readonly string[];
}

/** Warm halos under exactly five markers in a scoring row. */
export interface AssistRunRowGlow {
  /** The five markers that form (or will form) the scored run. */
  markerCells: readonly number[];
  /** Brighter subset when hovering one run option among several. */
  highlightCells?: readonly number[];
  strength: 'announce' | 'option' | 'hover';
}

/** World-space sizing for row halos (game-specific marker radius). */
export interface AssistRunGlowStyle {
  /** Seated marker radius in world units. */
  markerRadius: number;
  /** Halo outer radius = markerRadius × scale (default 1.4). */
  haloScale?: number;
}

/** Ring removal pick hints (after a row is scored). */
export interface AssistRingPickGlow {
  cell: number;
  strength?: 'option' | 'hover';
}

export interface BoardAssistStats {
  visibleMeshCount: number;
  pathSegmentCount: number;
  /** Visible marker-preview discs (ring-centre placement ghosts). */
  markerGhostCount: number;
  /** Minimum opacity among visible marker ghosts (0 when none). */
  markerGhostMinOpacity: number;
  /** Distinct board cells with row celebration halos. */
  runGlowCellCount: number;
}

export interface SceneApi {
  setSnapshot(snapshot: BoardSnapshot): void;
  setInteraction(view: InteractionView): void;
  /** Unlit legal-move overlays (dots, paths, highlights). */
  setBoardAssist(state: BoardAssistState | null): void;
  /** Debug / e2e: counts visible assist meshes after the last {@link setBoardAssist}. */
  getBoardAssistStats(): BoardAssistStats;
  /** Outline markers that would flip on a previewed move (no albedo override). */
  setFlipPreview(pieceIds: readonly string[]): void;
  /** World position of a piece mesh (XZ center; Y = mesh origin). */
  getPieceWorldPosition(pieceId: string): { x: number; y: number; z: number } | null;
  setTheme(theme: ThemeId): void;
  /** Shared top / axo camera presets (Back-to-Lobby bar Camera button). */
  createCameraViews(options?: { getBounds?: () => THREE.Vector3[] }): CameraViewController;
  setCameraMode(mode: 'pan' | 'orbit'): void;
  hitTest(clientX: number, clientY: number): number | null;
  hitReserve(clientX: number, clientY: number): ReservePick | null;
  reserveScreen(pick: ReservePick): Point;
  cellScreen(index: number): Point;
  /** Queue AI / remote moves through the same animation path. */
  enqueueAnimation(task: () => Promise<void>): Promise<void>;
  /** True while {@link enqueueAnimation} tasks or tweens are still running. */
  animationsBusy(): boolean;
  drainAnimations(): Promise<void>;
  /** Recompute orthographic framing from {@link Topology.frameCorners}. */
  reframe(): void;
  /** Aim the camera before {@link reframe} (orthographic zoom still comes from fit). */
  setCameraView(options?: { elevationDeg?: number; azimuthDeg?: number; target?: { x: number; y: number; z: number } }): void;
  /** Animate a flippable piece (Yinsh marker, Tak flat/standing stone). */
  flipPiece(pieceId: string): Promise<void>;
  flipPieces(pieceIds: string[], staggerMs?: number): Promise<void>;
  /** World Y of the top of the built-in board slab (playfield surface). */
  getBoardTopY(): number;
  /** World Y of the bottom piece base in each cell stack and reserve pile. */
  getStackBottomBaseYs(): number[];
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
  /** Warm gold/amber accent for five-in-a-row celebration halos. */
  runCelebration: string;
  piece: Record<PlayerId, { fill: string; rim: string; edge: string }>;
  ghostOpacity: number;
  shadow: string;
}
