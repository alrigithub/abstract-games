import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AnimationQueue } from './animation-queue';
import {
  applyBoardGridLineScreenScale,
  boardGridLineScreenScale,
  tagBoardGridLine,
} from './board-grid-lines';
import { createCameraViewController, fitOrthographicToWorldPoints, type CameraViewController } from './camera-views';
import { ANIMATION, BOARD, CAMERA } from './constants';
import { decoratePieceMesh } from './geometries/piece-outlines';
import { stackHeight } from './stack';
import { layoutStackCenters, stackExtent, type StackMeasure } from './stack-layout';
import {
  applyBoardLighting,
  syncSceneShadowCatcher,
  tagPieceForShadows,
  tagPlayfieldForShadows,
} from './board-lighting';
import { applyBoardEnvironment, createBoardWebGLRenderer, measureBoardFrameMs } from './board-renderer';
import { BoardAssistLayer } from './board-assist';
import { WIN_ACCENT } from './theme';

const FLIP_HALO_NAME = 'flip-preview-halo';
import {
  configurePlaceSfxPools,
  consumeBoopPushLandingSound,
  initPlaceSfx,
  isBoopPushLandingBatchActive,
  playPiecePlaceSound,
  type PlaceSoundKind,
  type PlaceSfxPools,
} from './sound/place-sfx';
import { themeTokens, type ThemeId } from './theme';
import type {
  BoardAssistState,
  BoardSnapshot,
  EnginePiece,
  InteractionView,
  PieceGeometrySet,
  Point,
  ReservePick,
  SceneApi,
  Topology,
} from './types';

const EMPTY_VIEW: InteractionView = { selection: null, dragging: false, pointer: null, origin: null, target: null, progress: 0 };

interface PieceObject {
  mesh: THREE.Object3D;
  pieceId: string;
  position: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  started: number;
  duration: number;
  selected: boolean;
  pickupAt: number;
  horizontalStarted: number;
  horizontalFrom: THREE.Vector2;
  horizontalTo: THREE.Vector2;
  flipFromX: number;
  flipToX: number;
  flipStarted: number;
  flipDuration: number;
  flipSwapped: boolean;
  pieceHeight: number;
  restX: number;
  restZ: number;
  landOnComplete?: PlaceSoundKind;
  lastVertT: number;
}

export interface BoardSceneOptions {
  /** Playable grid extent (cells per side). */
  gridSize: number;
  topology: Topology;
  pieces: PieceGeometrySet;
  /** Players used for materials (default A/B). */
  players?: string[];
  initialTheme?: ThemeId;
  /** Board slab thickness in world units (default {@link BOARD.SLAB}). */
  boardSlab?: number;
  /** Y of the playfield/table top where piece bases rest (default 0). */
  playfieldSurfaceY?: number;
  /** Lower pieces in a stack receive shadows (Tak / Tzaar). */
  stackedPiecesReceiveShadow?: boolean;
  /** Optional placement / boop push clip URLs (must be set before audio init). */
  placeSfx?: PlaceSfxPools;
}

export async function createBoardScene(container: HTMLElement, options: BoardSceneOptions): Promise<SceneApi> {
  if (options.placeSfx) configurePlaceSfxPools(options.placeSfx);
  initPlaceSfx();
  const players = options.players ?? ['A', 'B'];
  const boardSlab = options.boardSlab ?? BOARD.SLAB;
  const playfieldY = options.playfieldSurfaceY ?? BOARD.PLAYFIELD_SURFACE_Y;
  let themeId: ThemeId = options.initialTheme ?? 'light';
  options.pieces.onThemeChange?.(themeId);
  let tokens = themeTokens(themeId);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(tokens.table);
  const renderer = createBoardWebGLRenderer();
  const disposeEnvironment = applyBoardEnvironment(scene, renderer);
  const boardLighting = applyBoardLighting(scene, renderer);
  const stackedPiecesReceiveShadow = options.stackedPiecesReceiveShadow ?? false;
  container.appendChild(renderer.domElement);

  const playfieldShadowBounds = new THREE.Box3();

  function syncShadowFrustum() {
    const points = collectFramePoints().map(p => p.clone());
    boardLighting.fitToPoints(points);
    playfieldShadowBounds.makeEmpty();
    for (const p of points) playfieldShadowBounds.expandByPoint(p);
    playfieldShadowBounds.min.y = BOARD.PLAYFIELD_SURFACE_Y;
    playfieldShadowBounds.max.y = BOARD.PLAYFIELD_SURFACE_Y + 0.01;
    playfieldShadowBounds.expandByScalar(0.85);
    syncSceneShadowCatcher(scene, playfieldShadowBounds, 0.55);
  }

  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.position);
  camera.lookAt(0, 0, 0);

  const board = new THREE.Group();
  const piecesGroup = new THREE.Group();
  const ghostGroup = new THREE.Group();
  const reserveGroup = new THREE.Group();
  const pilesGroup = new THREE.Group();
  scene.add(board, piecesGroup, ghostGroup, reserveGroup, pilesGroup);
  const assistLayer = new BoardAssistLayer();
  assistLayer.attach(scene);
  assistLayer.applyTheme(tokens);
  let assistState: BoardAssistState | null = null;
  let flipPreviewIds = new Set<string>();
  let flipHaloMaterial = new THREE.MeshBasicMaterial({
    color: WIN_ACCENT,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const edgeCache = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();
  let outlineMaterial = new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide });
  let edgeMaterials: Record<string, THREE.LineBasicMaterial> = {};
  let pieceMaterials: Record<string, THREE.MeshBasicMaterial> = {};
  let ghostMaterials: Record<string, THREE.MeshBasicMaterial> = {};
  let boardMaterial = new THREE.MeshBasicMaterial({
    color: tokens.board,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  let gridMaterial = new THREE.MeshBasicMaterial({
    color: tokens.lines,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  function rebuildMaterials() {
    tokens = themeTokens(themeId);
    scene.background = new THREE.Color(tokens.table);
    boardMaterial.color.set(tokens.board);
    gridMaterial.color.set(tokens.lines);
    outlineMaterial.dispose();
    outlineMaterial = new THREE.MeshBasicMaterial({ color: tokens.lines, side: THREE.BackSide });
    for (const m of Object.values(edgeMaterials)) m.dispose();
    for (const m of Object.values(pieceMaterials)) m.dispose();
    for (const m of Object.values(ghostMaterials)) m.dispose();
    edgeMaterials = {};
    pieceMaterials = {};
    ghostMaterials = {};
    for (const player of players) {
      const t = tokens.piece[player] ?? tokens.piece.A!;
      edgeMaterials[player] = new THREE.LineBasicMaterial({ color: t.edge, transparent: true, opacity: 0.85 });
      pieceMaterials[player] = new THREE.MeshBasicMaterial({ color: t.fill, toneMapped: false });
      pieceMaterials[`${player}Selected`] = new THREE.MeshBasicMaterial({ color: t.fill, toneMapped: false });
      ghostMaterials[player] = new THREE.MeshBasicMaterial({
        color: t.fill,
        transparent: true,
        opacity: tokens.ghostOpacity,
        depthWrite: false,
        toneMapped: false,
      });
    }
  }
  rebuildMaterials();

  const height = (piece: { shape: string; id: string }) => options.pieces.height(piece as never);
  const geometry = (piece: { shape: string }) => options.pieces.geometry(piece as never);
  const pieceYaw = (id: string) => options.pieces.yaw(id);
  const pieceEdgeThreshold = options.pieces.edgeThreshold ?? BOARD.EDGE_THRESHOLD_TAK;
  const verticalOffset = (piece: EnginePiece, stackIndex: number, stack: EnginePiece[]) =>
    options.pieces.verticalOffset?.(piece, stackIndex, stack) ?? 0;
  const stackMeasure: StackMeasure = {
    heightOf: piece => height(piece as never),
    offsetOf: verticalOffset,
  };

  function meshYFromStackCenter(centerY: number, piece: EnginePiece): number {
    if (options.pieces.geometryOrigin === 'base') return centerY - height(piece as never) / 2;
    return centerY;
  }

  function pieceUsesOutline(piece: EnginePiece) {
    return options.pieces.useOutline?.(piece) !== false;
  }

  function applyPieceMaterial(object: THREE.Object3D, piece: EnginePiece, selected = false) {
    const custom = options.pieces.materialFor?.(piece, tokens, selected);
    if (custom === null) return;
    const mat = custom ?? pieceMaterials[`${piece.player}${selected ? 'Selected' : ''}`] ?? pieceMaterials.A!;
    if (object instanceof THREE.Mesh) {
      object.material = mat;
      return;
    }
    object.traverse(node => {
      if (node instanceof THREE.Mesh) node.material = mat;
    });
  }

  function createPieceMesh(piece: EnginePiece, selected = false): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry(piece as never));
    applyPieceMaterial(mesh, piece, selected);
    if (pieceUsesOutline(piece)) {
      decoratePieceMesh(mesh, edgeMaterials[piece.player]!, outlineMaterial, edgeCache, pieceEdgeThreshold);
    }
    return mesh;
  }

  function createPieceVisual(piece: EnginePiece, selected = false): THREE.Object3D {
    if (options.pieces.createVisual) {
      const visual = options.pieces.createVisual(piece);
      visual.userData.pieceId = piece.id;
      visual.userData.player = piece.player;
      visual.userData.shape = piece.shape;
      applyPieceMaterial(visual, piece, selected);
      tagPieceForShadows(visual, false);
      return visual;
    }
    const mesh = createPieceMesh(piece, selected);
    tagPieceForShadows(mesh, false);
    return mesh;
  }

  function swapMarkerPlayer(item: PieceObject) {
    const player = (item.mesh.userData.player as string) === 'A' ? 'B' : 'A';
    item.mesh.userData.player = player;
    const piece = { id: item.pieceId, player, shape: 'marker' } as EnginePiece;
    if (options.pieces.replaceVisual) {
      options.pieces.replaceVisual(item.mesh, piece);
      applyPieceMaterial(item.mesh, piece);
      tagPieceForShadows(item.mesh, false);
      item.mesh.rotation.x = item.flipFromX;
      item.flipToX = item.flipFromX;
    } else {
      applyPieceMaterial(item.mesh, piece);
    }
  }

  function syncPieceShape(item: PieceObject, piece: EnginePiece) {
    if (item.mesh.userData.shape === piece.shape) return;
    if (options.pieces.replaceVisual) {
      options.pieces.replaceVisual(item.mesh, piece);
      item.mesh.userData.shape = piece.shape;
      tagPieceForShadows(item.mesh, false);
      return;
    }
    if (!(item.mesh instanceof THREE.Mesh)) return;
    if (item.mesh.geometry === geometry(piece as never)) return;
    item.mesh.geometry = geometry(piece as never);
    if (pieceUsesOutline(piece)) {
      decoratePieceMesh(item.mesh, edgeMaterials[piece.player]!, outlineMaterial, edgeCache, pieceEdgeThreshold);
    }
    item.mesh.userData.shape = piece.shape;
  }

  function syncFlipHalos() {
    for (const item of objects.values()) {
      const active = flipPreviewIds.has(item.pieceId) && item.mesh.userData.shape === 'marker';
      let halo = item.mesh.getObjectByName(FLIP_HALO_NAME);
      if (active) {
        if (!halo) {
          const geo = new THREE.RingGeometry(0.26, 0.34, BOARD.RADIAL_SEGMENTS);
          halo = new THREE.Mesh(geo, flipHaloMaterial);
          halo.name = FLIP_HALO_NAME;
          halo.rotation.x = -Math.PI / 2;
          halo.renderOrder = 12;
          item.mesh.add(halo);
        }
        halo.visible = true;
        halo.position.set(0, -item.pieceHeight / 2 + BOARD.LINE_Y + 0.01, 0);
      } else if (halo) {
        halo.visible = false;
      }
    }
  }

  function refreshPieceMaterials() {
    for (const item of objects.values()) {
      const player = item.mesh.userData.player as string;
      const shape = item.mesh.userData.shape as string;
      if (!shape) continue;
      applyPieceMaterial(item.mesh, { id: item.pieceId, player, shape });
    }
    for (const mesh of pilesGroup.children) {
      if (!(mesh instanceof THREE.Object3D)) continue;
      const pick = mesh.userData.reserve as ReservePick | undefined;
      if (!pick) continue;
      applyPieceMaterial(mesh, { id: 'reserve', player: pick.player, shape: pick.shape });
    }
  }

  function refreshPieceVisuals() {
    if (!options.pieces.replaceVisual) return;
    for (const item of objects.values()) {
      const player = item.mesh.userData.player as string;
      const shape = item.mesh.userData.shape as string;
      if (!shape) continue;
      const piece = { id: item.pieceId, player, shape } as EnginePiece;
      options.pieces.replaceVisual!(item.mesh, piece);
      applyPieceMaterial(item.mesh, piece);
      const stack = snapshot.cells[Number(item.mesh.userData.cellIndex)] ?? [];
      const stackIndex = stack.findIndex(p => p.id === item.pieceId);
      tagPieceForShadows(item.mesh, stackedPiecesReceiveShadow && stackIndex > 0);
    }
    for (const mesh of pilesGroup.children) {
      if (!(mesh instanceof THREE.Object3D)) continue;
      const pick = mesh.userData.reserve as ReservePick | undefined;
      if (!pick) continue;
      const piece = { id: 'reserve', player: pick.player, shape: pick.shape } as EnginePiece;
      options.pieces.replaceVisual!(mesh, piece);
      applyPieceMaterial(mesh, piece);
      tagPieceForShadows(mesh, false);
    }
  }

  const shadowBounds = new THREE.Box3();

  const boardGeometries: THREE.BufferGeometry[] = [];
  const reserveTargets = new Map<string, THREE.Object3D>();
  const reserveSlots: { pick: ReservePick; position: THREE.Vector2 }[] = [];

  function swapFlippedStoneShape(item: PieceObject) {
    const shape = item.mesh.userData.shape as string;
    if (shape !== 'flat' && shape !== 'standing') return;
    const nextShape = shape === 'flat' ? 'standing' : 'flat';
    const player = item.mesh.userData.player as string;
    syncPieceShape(item, { shape: nextShape, id: item.pieceId, player } as EnginePiece);
  }

  let snapshot: BoardSnapshot = { playableCells: options.gridSize ** 2, cellCount: options.gridSize ** 2, cells: [] };
  let view: InteractionView = EMPTY_VIEW;
  let disposed = false;
  let frame = 0;
  let framed = false;
  let width = 0;
  let viewportHeight = 0;
  let bufferWidth = 0;
  let bufferHeight = 0;
  let selectedIds = new Set<string>();
  let reserveKey = '';
  const objects = new Map<string, PieceObject>();
  const animQueue = new AnimationQueue();
  let inAnimTask = false;

  function runFlipAnimation(work: () => Promise<void>): Promise<void> {
    if (inAnimTask) return work();
    return animQueue.enqueue(work);
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const rayPoint = new THREE.Vector3();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touches = new Map<number, PointerEvent>();
  let pressBlocksCamera = false;
  let replayingTouch = false;
  let controls: OrbitControls;
  let cameraViewsRef: CameraViewController | null = null;

  function cellPosition(index: number) {
    return options.topology.cellPosition(index, snapshot);
  }

  function projectPointer(point: Point, elevation = 0): THREE.Vector3 | null {
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    pointer.set(((point.x - bounds.left) / bounds.width) * 2 - 1, -((point.y - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    plane.constant = -elevation;
    return raycaster.ray.intersectPlane(plane, rayPoint)?.clone() ?? null;
  }

  function requestRender() {
    if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(render);
  }

  function finishLandSound(item: PieceObject) {
    if (!item.landOnComplete) return;
    const kind = item.landOnComplete;
    item.landOnComplete = undefined;
    if (kind === 'place' && !consumeBoopPushLandingSound()) return;
    playPiecePlaceSound({ kind });
  }

  function render(now: number) {
    frame = 0;
    if (disposed || document.hidden) return;
    let animated = false;
    for (const item of objects.values()) {
      const t = reducedMotion.matches ? 1 : Math.min(1, Math.max(0, (now - item.started) / item.duration));
      const prevT = item.lastVertT;
      item.mesh.position.lerpVectors(item.from, item.to, ANIMATION.easeOutCubic(t));
      if (item.selected && !reducedMotion.matches) {
        const horizontalT = Math.min(1, Math.max(0, (now - item.horizontalStarted) / ANIMATION.HORIZONTAL_DURATION));
        const eased = ANIMATION.easeOutCubic(horizontalT);
        item.mesh.position.x = THREE.MathUtils.lerp(item.horizontalFrom.x, item.horizontalTo.x, eased);
        item.mesh.position.z = THREE.MathUtils.lerp(item.horizontalFrom.y, item.horizontalTo.y, eased);
        if (horizontalT < 1) animated = true;
      }
      if (item.flipDuration > 0) {
        const flipT = reducedMotion.matches
          ? 1
          : Math.min(1, Math.max(0, (now - item.flipStarted) / item.flipDuration));
        const easedFlip = ANIMATION.easeOutCubic(flipT);
        item.mesh.rotation.x = THREE.MathUtils.lerp(item.flipFromX, item.flipToX, easedFlip);
        if (!item.flipSwapped && flipT >= 0.5) {
          item.flipSwapped = true;
          const shape = item.mesh.userData.shape as string;
          if (shape === 'marker') {
            swapMarkerPlayer(item);
          } else if (shape === 'flat' || shape === 'standing') {
            swapFlippedStoneShape(item);
          }
        }
        if (flipT < 1) animated = true;
        else item.flipDuration = 0;
      }
      if (t < 1) animated = true;
      else if (prevT < 1 && item.landOnComplete) finishLandSound(item);
      item.lastVertT = t;
    }
    const assistAnim = assistLayer.tick(now);
    renderer.render(scene, camera);
    if (animated || assistAnim) requestRender();
  }

  function targetObject(item: PieceObject, target: THREE.Vector3, immediate: boolean, duration: number = ANIMATION.DURATION) {
    if (item.selected && !immediate && !reducedMotion.matches) {
      if (item.horizontalTo.x !== target.x || item.horizontalTo.y !== target.z) {
        item.horizontalFrom.set(item.mesh.position.x, item.mesh.position.z);
        item.horizontalTo.set(target.x, target.z);
        item.horizontalStarted = Math.max(performance.now(), item.pickupAt + ANIMATION.PICKUP_HORIZONTAL_DELAY);
      }
      item.from.x = item.to.x = target.x;
      item.from.z = item.to.z = target.z;
      if (Math.abs(item.to.y - target.y) < 0.000001) return;
    } else if (item.to.distanceToSquared(target) < 0.000001) return;
    item.from.copy(item.mesh.position);
    item.to.copy(target);
    item.started = performance.now();
    item.duration = duration;
    if (!immediate && !reducedMotion.matches && !item.selected) {
      const dy = target.y - item.from.y;
      const xzMoved = Math.hypot(target.x - item.restX, target.z - item.restZ) > 0.08;
      if (dy < -0.008) {
        item.landOnComplete = xzMoved ? 'place' : 'cancel';
      } else if (xzMoved && isBoopPushLandingBatchActive()) {
        item.landOnComplete = 'place';
      }
    }
    if (immediate || reducedMotion.matches) {
      item.mesh.position.copy(target);
      item.from.copy(target);
      item.started -= duration;
      if (item.landOnComplete) finishLandSound(item);
    }
    requestRender();
  }

  function pickIntersection(clientX: number, clientY: number) {
    if (!projectPointer({ x: clientX, y: clientY })) return null;
    scene.updateMatrixWorld(true);
    const meshes = [...piecesGroup.children, ...pilesGroup.children, ...board.children.filter(c => c instanceof THREE.Mesh)].filter(m => m.visible);
    return raycaster.intersectObjects(meshes, true)[0] ?? null;
  }

  function pickSurface(clientX: number, clientY: number) {
    return pickIntersection(clientX, clientY)?.object ?? null;
  }

  function cellAtPointer(clientX: number, clientY: number): number | null {
    const point = projectPointer({ x: clientX, y: clientY });
    if (!point) return null;
    return options.topology.cellAtWorld(point.x, point.z, snapshot);
  }

  function pickableAtPointer(clientX: number, clientY: number): boolean {
    const cell = cellAtPointer(clientX, clientY);
    if (cell !== null && (snapshot.cells[cell]?.length ?? 0) > 0) return true;
    const slot = slotAt(clientX, clientY);
    if (slot) {
      const count = snapshot.reserves?.find(s => s.id === slot.pick.slotId)?.count ?? 0;
      return count > 0;
    }
    return false;
  }

  function updateControlsEnabled() {
    controls.enabled = touches.size > 1 || (!view.selection && !pressBlocksCamera);
  }

  function onPileBlur() {
    touches.clear();
    blockedTouchId = null;
    pressBlocksCamera = false;
    delete container.dataset.cameraGesture;
    updateControlsEnabled();
  }

  let blockedTouchId: number | null = null;
  function onPointerDownCapture(event: PointerEvent) {
    if (replayingTouch) return;
    if (event.pointerType === 'touch') touches.set(event.pointerId, event);
    if (touches.size > 1) {
      container.dataset.cameraGesture = 'true';
      pressBlocksCamera = false;
      controls.enabled = true;
      container.dispatchEvent(new CustomEvent('camera-gesture', { detail: { active: true } }));
      const first = [...touches.values()].find(t => t.pointerId !== event.pointerId);
      if (first && blockedTouchId === first.pointerId) {
        replayingTouch = true;
        renderer.domElement.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerId: first.pointerId,
            pointerType: 'touch',
            clientX: first.clientX,
            clientY: first.clientY,
            button: 0,
            buttons: 1,
            isPrimary: true,
            bubbles: false,
          }),
        );
        replayingTouch = false;
        blockedTouchId = null;
      }
      return;
    }
    pressBlocksCamera = event.button !== 2 && (!!view.selection || pickableAtPointer(event.clientX, event.clientY));
    if (pressBlocksCamera && event.pointerType === 'touch') blockedTouchId = event.pointerId;
    updateControlsEnabled();
  }

  container.addEventListener('pointerdown', onPointerDownCapture, true);
  window.addEventListener('blur', onPileBlur);
  window.addEventListener('pointerup', onPointerRelease);
  window.addEventListener('pointercancel', onPointerRelease);

  function onPointerRelease(event: PointerEvent) {
    touches.delete(event.pointerId);
    if (blockedTouchId === event.pointerId) blockedTouchId = null;
    if (touches.size < 2 && container.dataset.cameraGesture) {
      delete container.dataset.cameraGesture;
      container.dispatchEvent(new CustomEvent('camera-gesture', { detail: { active: false } }));
    }
    pressBlocksCamera = false;
    updateControlsEnabled();
  }

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = true;
  controls.rotateSpeed = CAMERA.rotateSpeed;
  controls.zoomSpeed = CAMERA.zoomSpeed;
  controls.minPolarAngle = CAMERA.minPolarAngle;
  controls.maxPolarAngle = CAMERA.maxPolarAngle;
  controls.minZoom = CAMERA.minZoom;
  controls.maxZoom = CAMERA.maxZoom;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.touches.ONE = THREE.TOUCH.PAN;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  function syncBoardGridLines() {
    applyBoardGridLineScreenScale(board, boardGridLineScreenScale(camera, viewportHeight));
  }

  controls.addEventListener('change', () => {
    camera.updateMatrixWorld();
    syncBoardGridLines();
    requestRender();
    container.dispatchEvent(new CustomEvent('camera-change'));
  });

  function collectFramePoints(): THREE.Vector3[] {
    const size = options.gridSize;
    const points: THREE.Vector3[] = options.topology.frameCorners?.(snapshot) ?? [];
    if (!points.length) {
      const half = size / 2 + 0.04;
      for (const x of [-half, half]) for (const z of [-half, half]) points.push(new THREE.Vector3(x, 0, z));
    }
    for (const slot of snapshot.reserves ?? []) {
      const top =
        stackHeight(
          Array.from({ length: slot.count }, () => ({ shape: slot.shape, id: 'x', player: slot.player })),
          p => height(p as never),
        ) + 0.025;
      for (const dx of [-0.43, 0.43])
        for (const dz of [-0.43, 0.43]) {
          points.push(
            new THREE.Vector3(slot.position.x + dx, 0, slot.position.z + dz),
            new THREE.Vector3(slot.position.x + dx, top, slot.position.z + dz),
          );
        }
    }
    return points;
  }

  function syncRendererSize() {
    const bounds = container.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    viewportHeight = Math.max(1, Math.round(bounds.height));
    const dpr = window.devicePixelRatio || 1;
    const renderScale = Math.min(
      Math.max(CAMERA.minRenderScale, dpr),
      CAMERA.maxPixelRatio,
      Math.sqrt(CAMERA.maxBufferPixels / (width * viewportHeight)),
    );
    const nextBufferWidth = Math.max(1, Math.round(width * renderScale));
    const nextBufferHeight = Math.max(1, Math.round(viewportHeight * renderScale));
    if (nextBufferWidth !== bufferWidth || nextBufferHeight !== bufferHeight) {
      bufferWidth = nextBufferWidth;
      bufferHeight = nextBufferHeight;
      renderer.setSize(bufferWidth, bufferHeight, false);
    }
    return width / viewportHeight;
  }

  function fit(reframe = false) {
    const aspect = syncRendererSize();
    if (cameraViewsRef) {
      cameraViewsRef.refit();
      requestRender();
      return;
    }
    const size = options.gridSize;
    if (framed && !reframe) {
      const centerX = (camera.left + camera.right) / 2;
      const halfHeight = (camera.top - camera.bottom) / 2;
      camera.left = centerX - halfHeight * aspect;
      camera.right = centerX + halfHeight * aspect;
      camera.updateProjectionMatrix();
      requestRender();
      return;
    }
    framed = true;
    camera.updateMatrixWorld();
    const points = collectFramePoints().map(p => p.clone());
    fitOrthographicToWorldPoints(camera, points, aspect, CAMERA.framePadding);
    syncBoardGridLines();
    syncShadowFrustum();
    requestRender();
  }

  function buildBoard() {
    board.clear();
    for (const geo of boardGeometries) geo.dispose();
    boardGeometries.length = 0;
    const size = options.gridSize;
    if (
      options.topology.buildBoard?.({
        board,
        boardMaterial,
        gridMaterial,
        boardGeometries,
        gridSize: size,
      })
    ) {
      buildPiles();
      tagPlayfieldForShadows(board);
      syncBoardGridLines();
      syncShadowFrustum();
      requestRender();
      return;
    }
    const planeGeo = new THREE.PlaneGeometry(size, size);
    boardGeometries.push(planeGeo);
    const boardPlane = new THREE.Mesh(planeGeo, boardMaterial);
    boardPlane.rotation.x = -Math.PI / 2;
    board.add(boardPlane);
    const half = size / 2;
    const lineWidth = BOARD.LINE_W;
    for (let i = 0; i <= size; i++) {
      const offset = i - half;
      for (const axis of ['x', 'z'] as const) {
        const geo = new THREE.PlaneGeometry(axis === 'x' ? lineWidth : size + lineWidth, axis === 'z' ? lineWidth : size + lineWidth);
        boardGeometries.push(geo);
        const line = new THREE.Mesh(geo, gridMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(axis === 'x' ? offset : 0, BOARD.LINE_Y, axis === 'z' ? offset : 0);
        tagBoardGridLine(line, { thicknessAxis: axis === 'x' ? 'x' : 'z' });
        board.add(line);
      }
    }
    buildPiles();
    tagPlayfieldForShadows(board);
    syncBoardGridLines();
    syncShadowFrustum();
    requestRender();
  }

  function reserveKeyFor(pick: ReservePick) {
    return `${pick.player}:${pick.shape}:${pick.pile}`;
  }

  function slotAt(clientX: number, clientY: number) {
    const point = projectPointer({ x: clientX, y: clientY });
    return point ? reserveSlots.find(slot => Math.abs(point.x - slot.position.x) <= 0.5 && Math.abs(point.z - slot.position.y) <= 0.5) : undefined;
  }

  function buildPiles() {
    pilesGroup.clear();
    reserveSlots.length = 0;
    reserveTargets.clear();
    for (const slot of snapshot.reserves ?? []) {
      if (slot.count <= 0) continue;
      const pick: ReservePick = { slotId: slot.id, player: slot.player, shape: slot.shape, pile: slot.pile };
      const position = new THREE.Vector2(slot.position.x, slot.position.z);
      reserveSlots.push({ pick, position });
      const pileKey = reserveKeyFor(pick);
      const pieceStub = { shape: slot.shape, id: 'reserve', player: slot.player };
      const h = height(pieceStub as never);
      const centers = layoutStackCenters(
        Array.from({ length: slot.count }, (_, level) => ({ ...pieceStub, id: `reserve-${level}` })),
        stackMeasure,
        playfieldY,
      );
      for (let level = 0; level < slot.count; level++) {
        const mesh = createPieceVisual({ ...pieceStub, id: `reserve-${level}` } as EnginePiece);
        mesh.position.set(position.x, meshYFromStackCenter(centers[level]!, pieceStub as never), position.y);
        mesh.userData.reserve = pick;
        mesh.userData.pileKey = pileKey;
        tagPieceForShadows(mesh, false);
        pilesGroup.add(mesh);
        if (level === 0) reserveTargets.set(pileKey, mesh);
      }
    }
  }

  function selectedPieces() {
    const selection = view.selection;
    if (!selection) return [];
    if (typeof selection.source !== 'number') {
      return Array.from({ length: selection.count }, (_, i) => ({
        id: `__reserve${i}`,
        player: (selection.source as ReservePick).player,
        shape: (selection.source as ReservePick).shape,
      }));
    }
    return snapshot.cells[selection.source]?.slice(-selection.count) ?? [];
  }

  function updateGhost(_selected: ReturnType<typeof selectedPieces>) {
    ghostGroup.visible = false;
  }

  function updateInteraction(immediate = false) {
    const selection = view.selection;
    const selected = selectedPieces();
    const lift = reducedMotion.matches ? 0 : ANIMATION.LIFT;
    selectedIds = new Set(typeof selection?.source === 'number' ? selected.map(p => p.id) : []);
    const targetCell = view.target === null ? null : cellPosition(view.target);
    const exterior = view.pointer ? slotAt(view.pointer.x, view.pointer.y) : null;
    const carriedPosition = targetCell ?? (exterior ? new THREE.Vector3(exterior.position.x, 0, exterior.position.y) : null);
    const sourcePosition = typeof selection?.source === 'number' ? cellPosition(selection.source) : null;
    const selectedBottom =
      selected.length && typeof selection?.source === 'number'
        ? stackExtent(snapshot.cells[selection.source]?.slice(0, -selected.length) ?? [], stackMeasure, playfieldY)
        : 0;
    const support =
      view.target === null
        ? exterior
          ? stackExtent(
              Array.from({ length: snapshot.reserves?.find(s => reserveKeyFor({ slotId: s.id, player: s.player, shape: s.shape, pile: s.pile }) === reserveKeyFor(exterior.pick))?.count ?? 0 }, (_, i) => ({
                id: `r${i}`,
                player: exterior.pick.player,
                shape: exterior.pick.shape,
              })),
              stackMeasure,
              playfieldY,
            )
          : 0
        : stackExtent(
            (snapshot.cells[view.target] ?? []).filter(p => !selectedIds.has(p.id)),
            stackMeasure,
            playfieldY,
          );
    for (const item of objects.values()) {
      const isSelected = selectedIds.has(item.pieceId);
      const stack = snapshot.cells[Number(item.mesh.userData.cellIndex)] ?? [];
      if (isSelected && !item.selected) {
        item.pickupAt = performance.now();
        item.restX = item.mesh.position.x;
        item.restZ = item.mesh.position.z;
        item.landOnComplete = undefined;
        item.horizontalFrom.set(item.mesh.position.x, item.mesh.position.z);
        item.horizontalTo.copy(item.horizontalFrom);
      }
      item.selected = isSelected;
      const player = (item.mesh.userData.player as string) ?? 'A';
      const shape = (item.mesh.userData.shape as string) ?? 'flat';
      applyPieceMaterial(item.mesh, { id: item.pieceId, player, shape }, isSelected);
      const target = item.position.clone();
      if (isSelected) {
        if (carriedPosition && sourcePosition) {
          target.x = carriedPosition.x;
          target.z = carriedPosition.z;
          target.y += support - selectedBottom;
        }
        target.y += lift;
      }
      targetObject(item, target, immediate, isSelected ? ANIMATION.LIFT_DURATION : ANIMATION.DURATION);
    }
    reserveGroup.visible = !!selection && typeof selection.source !== 'number';
    for (const source of pilesGroup.children) source.visible = true;
    if (selection && typeof selection.source !== 'number') {
      const key = `${reserveKeyFor(selection.source)}:${selection.source.shape}:${selection.count}`;
      if (key !== reserveKey) {
        reserveKey = key;
        reserveGroup.clear();
        selected.forEach((piece, index) => {
          const mesh = createPieceVisual(piece as EnginePiece, true);
          mesh.position.y = index * height(piece as never);
          reserveGroup.add(mesh);
        });
      }
      const source = reserveTargets.get(reserveKeyFor(selection.source));
      const srcPick = selection.source as ReservePick;
      const pileMeshes = pilesGroup.children.filter(m => m.userData.pileKey === reserveKeyFor(srcPick));
      pileMeshes.slice(-selection.count).forEach(m => {
        m.visible = false;
      });
      const sourcePosition3 = source?.position.clone() ?? new THREE.Vector3();
      const sourceHeight = height({ shape: selection.source.shape, id: 'r' } as never);
      sourcePosition3.y += lift - (selection.count - 1) * sourceHeight;
      const target = view.target;
      if (exterior && target === null) {
        reserveGroup.position.set(exterior.position.x, support + lift + sourceHeight / 2, exterior.position.y);
      } else if (target !== null) {
        const position = cellPosition(target);
        const stackH = stackHeight(snapshot.cells[target] ?? [], p => height(p as never));
        reserveGroup.position.set(position.x, playfieldY + stackH + lift + sourceHeight / 2, position.z);
      } else {
        reserveGroup.position.copy(sourcePosition3);
      }
    }
    updateGhost(selected);
    updateControlsEnabled();
    requestRender();
  }

  function setSnapshot(next: BoardSnapshot) {
    const prevReserves = JSON.stringify(snapshot.reserves);
    const reframeCamera =
      next.cellCount !== snapshot.cellCount ||
      next.playableCells !== snapshot.playableCells ||
      (!!options.topology.frameCorners && JSON.stringify(next.reserves) !== prevReserves);
    const previousSelected = selectedPieces().map(p => p.id);
    snapshot = {
      ...next,
      cells: next.cells.map(stack => stack.map(p => ({ ...p }))),
      reserves: next.reserves?.map(s => ({ ...s, position: { ...s.position } })),
    };
    const currentSelected = selectedPieces().map(p => p.id);
    if (typeof view.selection?.source === 'number' && previousSelected.join('|') !== currentSelected.join('|')) view = EMPTY_VIEW;
    buildPiles();
    const present = new Set<string>();
    snapshot.cells.forEach((stack, index) => {
      const position = cellPosition(index);
      const centers = layoutStackCenters(stack, stackMeasure, playfieldY);
      stack.forEach((piece, stackIndex) => {
        present.add(piece.id);
        const h = height(piece as never);
        const destination = new THREE.Vector3(
          position.x,
          meshYFromStackCenter(centers[stackIndex]!, piece),
          position.z,
        );
        let item = objects.get(piece.id);
        const prevPlayer = item?.mesh.userData.player as string | undefined;
        if (!item) {
          const mesh = createPieceVisual(piece as EnginePiece);
          mesh.position.copy(destination);
          mesh.rotation.y = pieceYaw(piece.id);
          if (piece.shape === 'marker' && !options.pieces.createVisual) mesh.rotation.x = piece.player === 'B' ? Math.PI : 0;
          mesh.userData.pieceId = piece.id;
          mesh.userData.cellIndex = index;
          mesh.userData.player = piece.player;
          mesh.userData.shape = piece.shape;
          piecesGroup.add(mesh);
          item = {
            mesh,
            pieceId: piece.id,
            position: destination.clone(),
            from: mesh.position.clone(),
            to: mesh.position.clone(),
            started: 0,
            duration: ANIMATION.DURATION,
            selected: false,
            pickupAt: 0,
            horizontalStarted: 0,
            horizontalFrom: new THREE.Vector2(mesh.position.x, mesh.position.z),
            horizontalTo: new THREE.Vector2(mesh.position.x, mesh.position.z),
            flipFromX: 0,
            flipToX: 0,
            flipStarted: 0,
            flipDuration: 0,
            flipSwapped: false,
            pieceHeight: h,
            restX: destination.x,
            restZ: destination.z,
            lastVertT: 1,
          };
          if (!view.selection && !view.dragging) {
            item.landOnComplete = 'place';
          }
          objects.set(piece.id, item);
        }
        item.pieceId = piece.id;
        item.pieceHeight = h;
        syncPieceShape(item, piece as EnginePiece);
        item.mesh.userData.player = piece.player;
        applyPieceMaterial(item.mesh, piece as EnginePiece);
        if (
          piece.shape === 'marker' &&
          options.pieces.replaceVisual &&
          item.flipDuration <= 0 &&
          prevPlayer !== undefined &&
          prevPlayer !== piece.player
        ) {
          options.pieces.replaceVisual(item.mesh, piece as EnginePiece);
          applyPieceMaterial(item.mesh, piece as EnginePiece);
        }
        if (piece.shape === 'marker' && item.flipDuration <= 0 && !options.pieces.createVisual) {
          const targetX = piece.player === 'B' ? Math.PI : 0;
          if (Math.abs(item.mesh.rotation.x - targetX) > 0.05) item.mesh.rotation.x = targetX;
        }
        item.mesh.userData.cellIndex = index;
        item.position.copy(destination);
        tagPieceForShadows(item.mesh, stackedPiecesReceiveShadow && stackIndex > 0);
      });
    });
    for (const [id, item] of objects) {
      if (!present.has(id)) {
        piecesGroup.remove(item.mesh);
        objects.delete(id);
      }
    }
    updateInteraction();
    assistLayer.update(assistState, cellPosition);
    syncFlipHalos();
    for (const item of objects.values()) {
      if (item.landOnComplete && item.lastVertT >= 1) finishLandSound(item);
    }
    if (reframeCamera) {
      if (cameraViewsRef) cameraViewsRef.refit();
      else fit(true);
      syncShadowFrustum();
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    const bounds = container.getBoundingClientRect();
    if (Math.max(1, Math.round(bounds.width)) === width && Math.max(1, Math.round(bounds.height)) === viewportHeight) return;
    fit();
    updateInteraction(true);
    container.dispatchEvent(new CustomEvent('camera-change'));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      onPileBlur();
      cancelAnimationFrame(frame);
      frame = 0;
    } else requestRender();
  });
  reducedMotion.addEventListener('change', () => updateInteraction(true));
  resizeObserver.observe(container);
  buildBoard();
  fit();

  async function runFlipPiece(pieceId: string) {
    const item = objects.get(pieceId);
    if (!item) return;
    const shape = item.mesh.userData.shape as string;
    const isMarker = shape === 'marker';
    const isTakStone = shape === 'flat' || shape === 'standing';
    if (!isMarker && !isTakStone) return;

    item.flipFromX = item.mesh.rotation.x;
    item.flipToX = item.mesh.rotation.x + Math.PI;
    item.flipStarted = performance.now();
    item.flipDuration = reducedMotion.matches ? 0 : ANIMATION.FLIP_DURATION;
    item.flipSwapped = false;
    requestRender();
    if (item.flipDuration <= 0) {
      item.mesh.rotation.x = item.flipToX;
      if (isMarker) swapMarkerPlayer(item);
      else swapFlippedStoneShape(item);
      return;
    }
    await new Promise<void>(done => {
      const wait = () => {
        if (item.flipDuration <= 0) {
          done();
          return;
        }
        requestAnimationFrame(wait);
      };
      wait();
    });
  }

  const api: SceneApi = {
    setSnapshot,
    createCameraViews(cameraOptions: { getBounds?: () => THREE.Vector3[] } = {}) {
      cameraViewsRef?.dispose();
      const getBounds = cameraOptions.getBounds ?? collectFramePoints;
      cameraViewsRef = createCameraViewController({
        camera,
        controls,
        getBounds,
        getAspect: () => {
          syncRendererSize();
          return width / viewportHeight;
        },
        onUpdate: requestRender,
      });
      framed = true;
      return cameraViewsRef;
    },
    setInteraction(next) {
      view = next;
      updateInteraction();
    },
    setTheme(id) {
      themeId = id;
      rebuildMaterials();
      options.pieces.onThemeChange?.(id);
      refreshPieceVisuals();
      refreshPieceMaterials();
      flipHaloMaterial.color.set(tokens.win);
      assistLayer.applyTheme(tokens);
      assistLayer.update(assistState, cellPosition);
      requestRender();
    },
    setBoardAssist(state) {
      assistState = state;
      assistLayer.update(assistState, cellPosition);
      requestRender();
      if (assistLayer.needsContinuousRender()) requestRender();
    },
    getBoardAssistStats() {
      return assistLayer.getStats();
    },
    setFlipPreview(pieceIds) {
      flipPreviewIds = new Set(pieceIds);
      syncFlipHalos();
      requestRender();
    },
    getPieceWorldPosition(pieceId) {
      const item = objects.get(pieceId);
      if (!item) return null;
      item.mesh.updateMatrixWorld(true);
      const p = new THREE.Vector3();
      item.mesh.getWorldPosition(p);
      return { x: p.x, y: p.y, z: p.z };
    },
    setCameraMode(mode) {
      controls.mouseButtons.LEFT = mode === 'orbit' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
      controls.touches.ONE = mode === 'orbit' ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
    },
    hitTest(clientX, clientY) {
      return cellAtPointer(clientX, clientY);
    },
    hitReserve(clientX, clientY) {
      const slot = slotAt(clientX, clientY);
      if (!slot) return null;
      const count = snapshot.reserves?.find(s => s.id === slot.pick.slotId)?.count ?? 0;
      return count > 0 ? { ...slot.pick } : null;
    },
    reserveScreen(pick) {
      const mesh = reserveTargets.get(reserveKeyFor(pick));
      const slot = snapshot.reserves?.find(s => s.id === pick.slotId);
      const position = mesh?.position.clone() ?? new THREE.Vector3(slot?.position.x ?? 0, 0, slot?.position.z ?? 0);
      if (mesh) position.y += height({ shape: pick.shape, id: 's' } as never) / 2;
      position.project(camera);
      const bounds = renderer.domElement.getBoundingClientRect();
      return { x: bounds.left + ((position.x + 1) * bounds.width) / 2, y: bounds.top + ((1 - position.y) * bounds.height) / 2 };
    },
    cellScreen(index) {
      const position = cellPosition(index);
      position.project(camera);
      const bounds = renderer.domElement.getBoundingClientRect();
      return { x: bounds.left + ((position.x + 1) * bounds.width) / 2, y: bounds.top + ((1 - position.y) * bounds.height) / 2 };
    },
    getBoardTopY() {
      return playfieldY;
    },
    getStackBottomBaseYs() {
      const ys: number[] = [];
      const baseY = (object: THREE.Object3D) => {
        object.updateMatrixWorld(true);
        shadowBounds.setFromObject(object);
        return shadowBounds.min.y;
      };
      snapshot.cells.forEach(stack => {
        if (!stack.length) return;
        const item = objects.get(stack[0]!.id);
        if (item && Number.isFinite(baseY(item.mesh))) ys.push(baseY(item.mesh));
      });
      for (const slot of snapshot.reserves ?? []) {
        if (slot.count <= 0) continue;
        const pick: ReservePick = { slotId: slot.id, player: slot.player, shape: slot.shape, pile: slot.pile };
        const mesh = reserveTargets.get(reserveKeyFor(pick));
        if (mesh && Number.isFinite(baseY(mesh))) ys.push(baseY(mesh));
      }
      return ys;
    },
    enqueueAnimation(task) {
      return animQueue.enqueue(async () => {
        inAnimTask = true;
        try {
          await task();
        } finally {
          inAnimTask = false;
        }
      });
    },
    animationsBusy() {
      return animQueue.busy;
    },
    drainAnimations() {
      return animQueue.drain();
    },
    reframe() {
      fit(true);
    },
    setCameraView(options: {
      elevationDeg?: number;
      azimuthDeg?: number;
      target?: { x: number; y: number; z: number };
    } = {}) {
      const elevation = ((options.elevationDeg ?? 35) * Math.PI) / 180;
      const azimuth = ((options.azimuthDeg ?? 42) * Math.PI) / 180;
      const polar = Math.PI / 2 - elevation;
      const target = options.target
        ? new THREE.Vector3(options.target.x, options.target.y, options.target.z)
        : controls.target.clone();
      controls.target.copy(target);
      const dist = 6;
      camera.position.set(
        target.x + Math.sin(polar) * Math.cos(azimuth) * dist,
        target.y + Math.cos(polar) * dist,
        target.z + Math.sin(polar) * Math.sin(azimuth) * dist,
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      controls.update();
      camera.updateMatrixWorld();
      requestRender();
    },
    flipPiece(pieceId) {
      return runFlipAnimation(async () => {
        await runFlipPiece(pieceId);
      });
    },
    flipPieces(pieceIds, staggerMs = 80) {
      return runFlipAnimation(async () => {
        for (let i = 0; i < pieceIds.length; i++) {
          if (i > 0 && staggerMs > 0) await new Promise(r => setTimeout(r, staggerMs));
          await runFlipPiece(pieceIds[i]!);
        }
      });
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', onPointerDownCapture, true);
      window.removeEventListener('blur', onPileBlur);
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('pointercancel', onPointerRelease);
      controls.dispose();
      disposeEnvironment();
      boardLighting.dispose();
      assistLayer.dispose();
      flipHaloMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('bench')) {
    (window as unknown as { __benchOneFrame?: () => number }).__benchOneFrame = () =>
      measureBoardFrameMs(renderer, scene, camera);
  }
  return api;
}
