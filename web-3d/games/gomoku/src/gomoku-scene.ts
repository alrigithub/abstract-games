import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  BOARD,
  CAMERA,
  GOMOKU_DIMS,
  ARENA_GLB_BOARD_LIGHTING,
  ARENA_GLB_SURFACE_COLOR,
  applyBoardEnvironment,
  applyBoardLighting,
  applyPlayfieldBackdrop,
  arenaPlayfieldGroundSize,
  attachLockedPlateZoom,
  boardDrawingBufferSize,
  createArenaGroundMaterial,
  createBoardRenderPipeline,
  createBoardWebGLRenderer,
  createCameraViewController,
  createPlayfieldGroundMesh,
  createPrerenderTileProxies,
  createPrerenderedArena,
  fitPlayfieldShadowCatcher,
  fitPrerenderedCamera,
  lockedPlateZoomLimits,
  plateTextureEdge,
  measureBoardFrameMs,
  syncSceneShadowCatcher,
  tagGhostForShadows,
  tagExcludeFromBounds,
  tagPieceForShadows,
  tagPlayfieldForShadows,
  gomokuCellWorld,
  gomokuThemeMaterials,
  playPiecePlaceSound,
  initPlaceSfx,
  type CameraViewController,
} from '@abstract/three-engine';
import { loadGomokuStoneAssets, type GomokuStoneAssets } from './gomoku-piece-models';
import { loadGomokuArenaLayout, type GomokuArenaLayout } from './gomoku-arena';
import { loadGomokuPrerender, type GomokuPlateCell } from './gomoku-prerender';
import { GomokuWinGlowLayer } from './gomoku-win-glow';

export type ScenePlayer = 'A' | 'B';

export interface StoneRecord {
  id: string;
  row: number;
  col: number;
  player: ScenePlayer;
}

export interface GomokuSceneOptions {
  stoneAssets?: GomokuStoneAssets;
  arenaLayout?: GomokuArenaLayout;
  /** Baked plate. Omit to load it. Pass null for the live `?arena=3d` board. */
  prerender?: Awaited<ReturnType<typeof loadGomokuPrerender>> | null;
  onCellClick?: (row: number, col: number) => void;
  canInteract?: () => boolean;
  hoverPlayer?: () => ScenePlayer | null;
}

export interface GomokuSceneApi {
  setStones(stones: StoneRecord[], winLine: { row: number; col: number }[] | null): void;
  setHover(row: number | null, col: number | null, player: ScenePlayer | null): void;
  animateDrop(stone: StoneRecord): Promise<void>;
  setInputEnabled(enabled: boolean): void;
  createCameraViews(): CameraViewController;
  dispose(): void;
}

const DROP_MS = 180;
const HALO_SURFACE_OFFSET = 0.0008;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export async function createGomokuScene(
  container: HTMLElement,
  options: GomokuSceneOptions = {},
): Promise<GomokuSceneApi> {
  initPlaceSfx();
  const materials = gomokuThemeMaterials();
  let inputEnabled = true;

  const platePromise = options.prerender === undefined ? loadGomokuPrerender() : Promise.resolve(options.prerender);
  const [stoneAssets, plate] = await Promise.all([
    options.stoneAssets ?? loadGomokuStoneAssets(materials),
    platePromise,
  ]);
  const arenaLayout = plate ? null : (options.arenaLayout ?? await loadGomokuArenaLayout());
  const plateCells = new Map<string, GomokuPlateCell>();
  for (const cell of plate?.cells ?? []) plateCells.set(`${cell.row},${cell.col}`, cell);

  const size = GOMOKU_DIMS.GRID;
  const dropLift = stoneAssets.stoneHeight * 2;
  const scene = new THREE.Scene();
  const prerendered = plate ? createPrerenderedArena(scene, plate.plate) : null;
  if (!plate) applyPlayfieldBackdrop(scene, ARENA_GLB_SURFACE_COLOR);

  const renderer = createBoardWebGLRenderer();
  const disposeEnvironment = applyBoardEnvironment(scene, renderer);
  const boardLighting = applyBoardLighting(scene, renderer, ARENA_GLB_BOARD_LIGHTING);
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.position);
  camera.lookAt(0, 0, 0);
  const renderPipeline = createBoardRenderPipeline(renderer, scene, camera, {
    aoEnabled: plate ? false : undefined,
    postprocessWithoutAo: !!plate,
  });
  const orbitTarget = new THREE.Vector3(0, 0, 0);

  const boardGroup = new THREE.Group();
  const stonesGroup = new THREE.Group();
  const ghostGroup = new THREE.Group();
  const winGlow = new GomokuWinGlowLayer();
  winGlow.attach(scene);
  if (plate && arenaLayout === null) {
    const span = plate.plate.camera.width;
    const hidden = new THREE.MeshBasicMaterial({
      color: ARENA_GLB_SURFACE_COLOR,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    hidden.colorWrite = false;
    const ground = createPlayfieldGroundMesh(hidden, arenaPlayfieldGroundSize(span));
    const shadow = createPlayfieldGroundMesh(
      new THREE.ShadowMaterial({ opacity: 0.22, depthWrite: false }),
      arenaPlayfieldGroundSize(span),
    );
    shadow.position.y = 0.001;
    const proxies = createPrerenderTileProxies(plate.cells, 0.92);
    boardGroup.add(ground, shadow, proxies.depth, proxies.shadow, plate.columns);
    scene.add(boardGroup, stonesGroup, ghostGroup);
  } else if (arenaLayout) {
    const arenaSpan = (() => {
      const frame = arenaLayout.frameBounds();
      return Math.max(frame.max.x - frame.min.x, frame.max.z - frame.min.z, 1);
    })();
    const ground = createPlayfieldGroundMesh(
      createArenaGroundMaterial(ARENA_GLB_SURFACE_COLOR),
      arenaPlayfieldGroundSize(arenaSpan),
    );
    // Cell tops rest on the shared playfield Y. The paving thickness hangs below that,
    // and an opaque ground at the tops would lid over the joints. Sit the same white
    // ground just under the tiles so the go grid reads.
    ground.position.y = Math.min(arenaLayout.pavingFloorY, BOARD.PLAYFIELD_SURFACE_Y) - BOARD.LINE_LIFT;
    boardGroup.add(ground);
    scene.add(boardGroup, stonesGroup, ghostGroup, arenaLayout.root);
  }
  tagPlayfieldForShadows(boardGroup);

  const stoneMeshes = new Map<string, THREE.Object3D>();
  let ghostMesh: THREE.Object3D | null = null;
  const pickPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD.PLAYFIELD_GROUND_SIZE, BOARD.PLAYFIELD_GROUND_SIZE),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pickPlane.rotation.x = -Math.PI / 2;
  tagExcludeFromBounds(pickPlane);
  boardGroup.add(pickPlane);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  let viewportW = 1;
  let viewportH = 1;

  function cellAt(row: number, col: number): { x: number; y: number; z: number } {
    const baked = plateCells.get(`${row},${col}`);
    if (baked) return baked;
    const point = gomokuCellWorld(size, row, col);
    return { x: point.x, y: arenaLayout?.surfaceY(row, col) ?? BOARD.PLAYFIELD_SURFACE_Y, z: point.z };
  }

  function stoneBaseY(row: number, col: number): number {
    return cellAt(row, col).y;
  }

  function syncShadowFrustum() {
    const bounds = arenaLayout?.frameBounds() ?? new THREE.Box3();
    if (!arenaLayout && plate) {
      bounds.setFromObject(plate.columns);
      for (const cell of plate.cells) bounds.expandByPoint(new THREE.Vector3(cell.x, cell.y, cell.z));
    }
    bounds.min.y = BOARD.PLAYFIELD_SURFACE_Y;
    bounds.max.y = Math.max(bounds.max.y, stoneBaseY(7, 7) + stoneAssets.stoneHeight);
    bounds.expandByScalar(0.2);
    boardLighting.fitToBox(bounds);
    const catcherBounds = bounds.clone();
    catcherBounds.min.y = BOARD.PLAYFIELD_SURFACE_Y;
    catcherBounds.max.y = BOARD.PLAYFIELD_SURFACE_Y + 0.01;
    catcherBounds.expandByScalar(0.85);
    syncSceneShadowCatcher(scene, catcherBounds, 0.55);
    fitPlayfieldShadowCatcher(boardGroup, catcherBounds, 0.55);
  }

  syncShadowFrustum();

  function upsertStone(record: StoneRecord, y = stoneBaseY(record.row, record.col)): THREE.Object3D {
    let mesh = stoneMeshes.get(record.id);
    const p = cellAt(record.row, record.col);
    const yaw = stoneAssets.yawForId(record.id);
    if (!mesh) {
      mesh = stoneAssets.createVisual(record.player);
      tagPieceForShadows(mesh, false);
      stonesGroup.add(mesh);
      stoneMeshes.set(record.id, mesh);
    } else if (!stoneAssets.usesGlb) {
      const mat = record.player === 'A' ? materials.stoneA : materials.stoneB;
      if (mesh instanceof THREE.Mesh) mesh.material = mat;
    }
    mesh.userData.player = record.player;
    mesh.rotation.y = yaw;
    mesh.position.set(p.x, y, p.z);
    return mesh;
  }

  function setWinGlow(cells: { row: number; col: number }[] | null) {
    if (!cells?.length) {
      winGlow.clear();
      return;
    }
    winGlow.setWorldCells(
      cells.map(c => {
        const p = cellAt(c.row, c.col);
        return { x: p.x, z: p.z, y: p.y + HALO_SURFACE_OFFSET };
      }),
    );
  }

  const _projected = new THREE.Vector3();
  function projectCell(cell: { x: number; y: number; z: number }, rect: DOMRect) {
    _projected.set(cell.x, cell.y, cell.z).project(camera);
    return {
      x: (_projected.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-_projected.y * 0.5 + 0.5) * rect.height + rect.top,
    };
  }

  function pickCell(clientX: number, clientY: number): { row: number; col: number } | null {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    if (plate) {
      const origin = projectCell(cellAt(0, 0), rect);
      const neighbor = projectCell(cellAt(0, 1), rect);
      const limit = Math.hypot(origin.x - neighbor.x, origin.y - neighbor.y) * 0.49;
      let best: { row: number; col: number } | null = null;
      let bestDistance = limit;
      for (const cell of plate.cells) {
        const point = projectCell(cell, rect);
        const distance = Math.hypot(point.x - clientX, point.y - clientY);
        if (distance <= bestDistance) {
          bestDistance = distance;
          best = cell;
        }
      }
      return best;
    }
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    const origin = (size - 1) / 2;
    const col = Math.round(hit.x + origin);
    const row = Math.round(hit.z + origin);
    if (row < 0 || col < 0 || row >= size || col >= size) return null;
    return { row, col };
  }

  let frame = 0;
  let disposed = false;
  let pulseLoop = 0;

  function render(now = performance.now()) {
    if (disposed) return;
    winGlow.tick(now);
    renderPipeline.render();
  }

  function stopPulseLoop() {
    if (pulseLoop) {
      cancelAnimationFrame(pulseLoop);
      pulseLoop = 0;
    }
  }

  function ensurePulseLoop() {
    if (!winGlow.needsContinuousRender() || pulseLoop || disposed) return;
    const loop = (now: number) => {
      pulseLoop = 0;
      if (disposed || !winGlow.needsContinuousRender()) return;
      render(now);
      pulseLoop = requestAnimationFrame(loop);
    };
    pulseLoop = requestAnimationFrame(loop);
  }

  function requestRender() {
    if (!frame) {
      frame = requestAnimationFrame(now => {
        frame = 0;
        render(now);
        ensurePulseLoop();
      });
    }
  }

  function updateGhost(row: number | null, col: number | null, player: ScenePlayer | null) {
    ghostGroup.clear();
    ghostMesh = null;
    if (row === null || col === null || !player) return;
    ghostMesh = stoneAssets.createGhostVisual(player);
    tagGhostForShadows(ghostMesh);
    const p = cellAt(row, col);
    ghostMesh.position.set(p.x, p.y, p.z);
    ghostGroup.add(ghostMesh);
    requestRender();
  }

  function onPointerMove(event: PointerEvent) {
    if (!inputEnabled || !options.canInteract?.()) {
      updateGhost(null, null, null);
      return;
    }
    const cell = pickCell(event.clientX, event.clientY);
    const player = options.hoverPlayer?.() ?? null;
    updateGhost(cell?.row ?? null, cell?.col ?? null, cell ? player : null);
  }

  let pendingTap: { row: number; col: number; x: number; y: number } | null = null;

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !inputEnabled || !options.canInteract?.()) return;
    if (renderer.domElement.dataset.cameraGesture === 'true') return;
    const cell = pickCell(event.clientX, event.clientY);
    if (cell) pendingTap = { ...cell, x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent) {
    if (!pendingTap || event.button !== 0) return;
    if (renderer.domElement.dataset.cameraGesture === 'true') {
      pendingTap = null;
      return;
    }
    const tap = pendingTap;
    pendingTap = null;
    if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) return;
    const cell = pickCell(event.clientX, event.clientY);
    if (cell && cell.row === tap.row && cell.col === tap.col) options.onCellClick?.(cell.row, cell.col);
  }

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(orbitTarget);
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
  controls.addEventListener('change', () => requestRender());
  let plateZoom: ReturnType<typeof attachLockedPlateZoom> | null = null;
  if (plate) {
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enabled = false;
    const limits = lockedPlateZoomLimits(plateTextureEdge(plate.plate.light), plate.plate.camera);
    plateZoom = attachLockedPlateZoom({
      camera,
      domElement: renderer.domElement,
      minZoom: limits.min,
      maxZoom: limits.max,
      onChange: requestRender,
    });
  }

  let cameraViewsRef: CameraViewController | null = null;
  let bufferW = 0;
  let bufferH = 0;

  function gomokuFramePoints(): THREE.Vector3[] {
    const bounds = arenaLayout!.frameBounds();
    const yTop = bounds.max.y + stoneAssets.stoneHeight * 0.35;
    return [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, yTop, bounds.max.z),
      new THREE.Vector3(bounds.min.x, yTop, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
    ];
  }

  function syncViewport() {
    const bounds = container.getBoundingClientRect();
    viewportW = Math.max(1, Math.round(bounds.width));
    viewportH = Math.max(1, Math.round(bounds.height));
    const buffer = boardDrawingBufferSize(viewportW, viewportH, { prerendered: !!plate });
    if (buffer.width !== bufferW || buffer.height !== bufferH) {
      bufferW = buffer.width;
      bufferH = buffer.height;
      renderPipeline.setSize(bufferW, bufferH);
    }
    return viewportW / viewportH;
  }

  function fit() {
    const aspect = syncViewport();
    if (plate) {
      fitPrerenderedCamera(camera, plate.plate.camera, aspect, plateZoom?.zoom() ?? 1);
      syncShadowFrustum();
      render();
      return;
    }
    if (cameraViewsRef) {
      cameraViewsRef.refit();
      render();
      return;
    }
    const points = gomokuFramePoints();
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const halfW = (maxX - minX) * 0.52;
    const halfH = (maxZ - minZ) * 0.52;
    const halfHeight = Math.max(halfW / aspect, halfH) * 1.06;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    syncShadowFrustum();
    render();
  }

  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('bench')) {
    (window as unknown as { __benchOneFrame?: () => number }).__benchOneFrame = () =>
      measureBoardFrameMs(renderer, scene, camera, () => renderPipeline.render());
  }

  const ro = new ResizeObserver(fit);
  ro.observe(container);
  fit();

  return {
    setStones(stones: StoneRecord[], winLine: { row: number; col: number }[] | null) {
      const keep = new Set(stones.map(s => s.id));
      for (const [id, mesh] of stoneMeshes) {
        if (!keep.has(id)) {
          stonesGroup.remove(mesh);
          stoneMeshes.delete(id);
        }
      }
      for (const s of stones) upsertStone(s);
      setWinGlow(winLine);
      requestRender();
    },
    setHover(row, col, player) {
      updateGhost(row, col, player);
    },
    animateDrop(stone: StoneRecord) {
      const baseY = stoneBaseY(stone.row, stone.col);
      const mesh = upsertStone(stone, baseY + dropLift);
      const start = performance.now();
      return new Promise<void>(resolve => {
        const tick = (now: number) => {
          const t = easeOutCubic(Math.min(1, (now - start) / DROP_MS));
          const y = THREE.MathUtils.lerp(baseY + dropLift, baseY, t);
          mesh.position.y = y;
          requestRender();
          if (t < 1) requestAnimationFrame(tick);
          else {
            playPiecePlaceSound();
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    },
    setInputEnabled(enabled: boolean) {
      inputEnabled = enabled;
      if (!enabled) updateGhost(null, null, null);
    },
    createCameraViews() {
      cameraViewsRef?.dispose();
      cameraViewsRef = createCameraViewController({
        camera,
        controls,
        getBounds: gomokuFramePoints,
        getAspect: () => {
          syncViewport();
          return viewportW / viewportH;
        },
        onUpdate: requestRender,
      });
      return cameraViewsRef;
    },
    dispose() {
      plateZoom?.dispose();
      prerendered?.dispose();
      cameraViewsRef?.dispose();
      disposed = true;
      stopPulseLoop();
      winGlow.dispose();
      ro.disconnect();
      controls.dispose();
      boardLighting.dispose();
      renderPipeline.dispose();
      disposeEnvironment();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      renderer.domElement.remove();
      stoneAssets.dispose();
    },
  };
}
