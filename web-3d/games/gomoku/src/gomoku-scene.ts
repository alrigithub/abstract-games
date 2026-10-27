import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  BOARD,
  CAMERA,
  GOMOKU_DIMS,
  applyBoardEnvironment,
  applyBoardLighting,
  applyBoardGridLineScreenScale,
  applyPlayfieldBackdrop,
  boardDrawingBufferSize,
  boardGridLineScreenScale,
  clayEnvMaterial,
  createBoardRenderPipeline,
  createBoardWebGLRenderer,
  createCameraViewController,
  createPlayfieldGroundMesh,
  fitPlayfieldShadowCatcher,
  gomokuCellWorld,
  gomokuHoshiPoints,
  gomokuThemeMaterials,
  initPlaceSfx,
  measureBoardFrameMs,
  playPiecePlaceSound,
  syncSceneShadowCatcher,
  tagBoardGridLine,
  tagExcludeFromBounds,
  tagGhostForShadows,
  tagPieceForShadows,
  tagPlayfieldForShadows,
  themeTokens,
  type CameraViewController,
} from '@abstract/three-engine';
import { loadGomokuStoneAssets, type GomokuStoneAssets } from './gomoku-piece-models';
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
  const tokens = themeTokens();
  let inputEnabled = true;

  const stoneAssets = options.stoneAssets ?? await loadGomokuStoneAssets(materials);
  const size = GOMOKU_DIMS.GRID;
  const dropLift = stoneAssets.stoneHeight * 2;
  const scene = new THREE.Scene();
  applyPlayfieldBackdrop(scene, tokens.table);

  const renderer = createBoardWebGLRenderer();
  const disposeEnvironment = applyBoardEnvironment(scene, renderer);
  const boardLighting = applyBoardLighting(scene, renderer, { ambientFill: true });
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.position);
  camera.lookAt(0, 0, 0);
  const renderPipeline = createBoardRenderPipeline(renderer, scene, camera);

  const boardGroup = new THREE.Group();
  const stonesGroup = new THREE.Group();
  const ghostGroup = new THREE.Group();
  const winGlow = new GomokuWinGlowLayer();
  winGlow.attach(scene);

  const ground = createPlayfieldGroundMesh(clayEnvMaterial(), BOARD.PLAYFIELD_GROUND_SIZE);
  boardGroup.add(ground);
  const gridMaterial = new THREE.MeshBasicMaterial({
    color: tokens.lines,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const gridGeometries: THREE.BufferGeometry[] = [];
  const origin = (size - 1) / 2;
  const span = size - 1;
  for (let i = 0; i < size; i++) {
    const offset = i - origin;
    for (const axis of ['x', 'z'] as const) {
      const geo = new THREE.PlaneGeometry(axis === 'x' ? BOARD.LINE_W : span, axis === 'z' ? BOARD.LINE_W : span);
      gridGeometries.push(geo);
      const line = new THREE.Mesh(geo, gridMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(axis === 'x' ? offset : 0, BOARD.LINE_Y, axis === 'z' ? offset : 0);
      tagBoardGridLine(line, { thicknessAxis: axis === 'x' ? 'x' : 'z' });
      boardGroup.add(line);
    }
  }
  const starGeometry = new THREE.CircleGeometry(GOMOKU_DIMS.STAR_R, 20);
  starGeometry.rotateX(-Math.PI / 2);
  gridGeometries.push(starGeometry);
  for (const [row, col] of gomokuHoshiPoints(size)) {
    const point = gomokuCellWorld(size, row, col);
    const star = new THREE.Mesh(starGeometry, gridMaterial);
    star.position.set(point.x, BOARD.LINE_Y + 0.0004, point.z);
    star.renderOrder = 1;
    boardGroup.add(star);
  }
  scene.add(boardGroup, stonesGroup, ghostGroup);
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

  let viewportW = 1;
  let viewportH = 1;
  let cameraViewsRef: CameraViewController | null = null;

  function cellAt(row: number, col: number): { x: number; y: number; z: number } {
    const point = gomokuCellWorld(size, row, col);
    return { x: point.x, y: BOARD.PLAYFIELD_SURFACE_Y, z: point.z };
  }

  function stoneBaseY(row: number, col: number): number {
    return cellAt(row, col).y;
  }

  function framePoints(): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const yTop = stoneAssets.stoneHeight + 0.35;
    const pad = GOMOKU_DIMS.MARGIN;
    for (const row of [0, size - 1]) {
      for (const col of [0, size - 1]) {
        const p = cellAt(row, col);
        for (const dx of [-pad, pad]) {
          for (const dz of [-pad, pad]) {
            points.push(new THREE.Vector3(p.x + dx, 0, p.z + dz), new THREE.Vector3(p.x + dx, yTop, p.z + dz));
          }
        }
      }
    }
    return points;
  }

  function syncShadowFrustum() {
    const bounds = new THREE.Box3();
    for (const point of framePoints()) bounds.expandByPoint(point);
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

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD.PLAYFIELD_SURFACE_Y);

  function pickCell(clientX: number, clientY: number): { row: number; col: number } | null {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
    const center = (size - 1) / 2;
    const col = Math.round(hit.x + center);
    const row = Math.round(hit.z + center);
    if (row < 0 || col < 0 || row >= size || col >= size) return null;
    const point = cellAt(row, col);
    // Whole cell, not an inscribed circle, so a click in a square still hits its intersection.
    if (Math.max(Math.abs(hit.x - point.x), Math.abs(hit.z - point.z)) > 0.5) return null;
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

  function syncGridLines() {
    applyBoardGridLineScreenScale(boardGroup, boardGridLineScreenScale(camera, viewportH));
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
  controls.target.set(0, 0, 0);
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
  controls.addEventListener('change', () => {
    syncGridLines();
    requestRender();
  });

  let bufferW = 0;
  let bufferH = 0;

  function syncViewport() {
    const bounds = container.getBoundingClientRect();
    viewportW = Math.max(1, Math.round(bounds.width));
    viewportH = Math.max(1, Math.round(bounds.height));
    const buffer = boardDrawingBufferSize(viewportW, viewportH);
    if (buffer.width !== bufferW || buffer.height !== bufferH) {
      bufferW = buffer.width;
      bufferH = buffer.height;
      renderPipeline.setSize(bufferW, bufferH);
    }
    return viewportW / viewportH;
  }

  function fit() {
    const aspect = syncViewport();
    if (cameraViewsRef) {
      cameraViewsRef.refit();
    } else {
      const points = framePoints();
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
    }
    syncGridLines();
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
          mesh.position.y = THREE.MathUtils.lerp(baseY + dropLift, baseY, t);
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
        getBounds: framePoints,
        getAspect: () => {
          syncViewport();
          return viewportW / viewportH;
        },
        onUpdate: () => {
          syncGridLines();
          requestRender();
        },
      });
      syncGridLines();
      return cameraViewsRef;
    },
    dispose() {
      cameraViewsRef?.dispose();
      disposed = true;
      stopPulseLoop();
      winGlow.dispose();
      ro.disconnect();
      controls.dispose();
      boardLighting.dispose();
      renderPipeline.dispose();
      disposeEnvironment();
      for (const geometry of gridGeometries) geometry.dispose();
      gridMaterial.dispose();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      renderer.domElement.remove();
      stoneAssets.dispose();
    },
  };
}
