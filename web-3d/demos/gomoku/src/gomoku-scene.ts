import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  applyBoardGridLineScreenScale,
  boardGridLineScreenScale,
  tagBoardGridLine,
} from '@abstract/three-engine/board-grid-lines';
import {
  BOARD,
  CAMERA,
  GOMOKU_DIMS,
  applyBoardEnvironment,
  applyBoardLighting,
  createBoardWebGLRenderer,
  createCameraViewController,
  createContactShadowBlob,
  measureBoardFrameMs,
  tagPieceForShadows,
  tagPlayfieldForShadows,
  createGomokuStoneGeometry,
  gomokuCellWorld,
  gomokuHoshiPoints,
  gomokuStoneRestCenterY,
  gomokuThemeMaterials,
  makePieceShadow,
  playPiecePlaceSound,
  initPlaceSfx,
  type CameraViewController,
  type ThemeId,
} from '@abstract/three-engine';

export const GOMOKU_WIN_ACCENT = '#3b82f6';

export type ScenePlayer = 'A' | 'B';

export interface StoneRecord {
  id: string;
  row: number;
  col: number;
  player: ScenePlayer;
}

export interface GomokuSceneOptions {
  theme?: ThemeId;
  onCellClick?: (row: number, col: number) => void;
  canInteract?: () => boolean;
  hoverPlayer?: () => ScenePlayer | null;
}

export interface GomokuSceneApi {
  setTheme(id: ThemeId): void;
  setStones(stones: StoneRecord[], winLine: { row: number; col: number }[] | null): void;
  setHover(row: number | null, col: number | null, player: ScenePlayer | null): void;
  animateDrop(stone: StoneRecord): Promise<void>;
  setInputEnabled(enabled: boolean): void;
  createCameraViews(): CameraViewController;
  dispose(): void;
}

const DROP_MS = 180;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function createGomokuScene(container: HTMLElement, options: GomokuSceneOptions = {}): GomokuSceneApi {
  initPlaceSfx();
  let themeId: ThemeId = options.theme ?? 'light';
  let materials = gomokuThemeMaterials(themeId);
  let inputEnabled = true;

  const size = GOMOKU_DIMS.GRID;
  const stoneGeo = createGomokuStoneGeometry();
  const restY = gomokuStoneRestCenterY();
  const dropLift = GOMOKU_DIMS.STONE_H * 2;
  const shadowY = 0.003;

  const scene = new THREE.Scene();
  scene.background = materials.table.clone();

  const renderer = createBoardWebGLRenderer();
  const disposeEnvironment = applyBoardEnvironment(scene, renderer);
  const boardLighting = applyBoardLighting(scene, renderer);
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.position);
  camera.lookAt(0, 0, 0);
  const orbitTarget = new THREE.Vector3(0, 0, 0);

  const boardGroup = new THREE.Group();
  const shadowsGroup = new THREE.Group();
  const stonesGroup = new THREE.Group();
  const ghostGroup = new THREE.Group();
  const winGroup = new THREE.Group();
  scene.add(boardGroup, shadowsGroup, stonesGroup, ghostGroup, winGroup);

  const disposables: THREE.BufferGeometry[] = [];
  const stoneMeshes = new Map<string, THREE.Mesh>();
  let ghostMesh: THREE.Mesh | null = null;
  let pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ visible: false }));
  pickPlane.rotation.x = -Math.PI / 2;
  boardGroup.add(pickPlane);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  let viewportW = 1;
  let viewportH = 1;

  function lineMesh(w: number, d: number, thicknessAxis: 'x' | 'z'): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(w, d);
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, materials.line);
    mesh.rotation.x = -Math.PI / 2;
    tagBoardGridLine(mesh, { thicknessAxis });
    return mesh;
  }

  function syncBoardGridLines() {
    applyBoardGridLineScreenScale(boardGroup, boardGridLineScreenScale(camera, viewportH));
  }

  function rebuildBoardMesh() {
    while (boardGroup.children.length > 1) boardGroup.remove(boardGroup.children[1]!);
    const span = size - 1;
    const boardSpan = span + GOMOKU_DIMS.MARGIN * 2;
    const planeGeo = new THREE.PlaneGeometry(boardSpan, boardSpan);
    disposables.push(planeGeo);
    const boardPlane = new THREE.Mesh(planeGeo, materials.board);
    boardPlane.rotation.x = -Math.PI / 2;
    boardGroup.add(boardPlane);
    boardGroup.add(createContactShadowBlob(boardSpan * BOARD.CONTACT_BLOB_SOFT_SCALE, GOMOKU_DIMS.SLAB));
    const yLine = BOARD.LINE_Y + 0.001;
    for (let i = 0; i < size; i++) {
      const offset = i - span / 2;
      const h = lineMesh(GOMOKU_DIMS.LINE_W, span, 'x');
      h.position.set(offset, yLine, 0);
      boardGroup.add(h);
      const v = lineMesh(span, GOMOKU_DIMS.LINE_W, 'z');
      v.position.set(0, yLine, offset);
      boardGroup.add(v);
    }
    for (const [row, col] of gomokuHoshiPoints(size)) {
      const star = new THREE.Mesh(new THREE.CircleGeometry(GOMOKU_DIMS.STAR_R, 24), materials.star);
      disposables.push(star.geometry as THREE.BufferGeometry);
      star.rotation.x = -Math.PI / 2;
      const p = gomokuCellWorld(size, row, col);
      star.position.set(p.x, yLine + 0.001, p.z);
      boardGroup.add(star);
    }
    tagPlayfieldForShadows(boardGroup);
    syncBoardGridLines();
    boardLighting.fitToPoints(gomokuFramePoints());
  }

  rebuildBoardMesh();

  function stoneMaterial(player: ScenePlayer) {
    return player === 'A' ? materials.stoneA : materials.stoneB;
  }

  function makeShadow(rotationY: number) {
    const shadow = makePieceShadow(stoneGeo, materials.stoneShadow, shadowsGroup);
    shadow.rotation.y = rotationY;
    return shadow;
  }

  function yawForId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return ((hash >>> 0) % 1000) / 1000 * (Math.PI / 8);
  }

  function upsertStone(record: StoneRecord, y = restY): THREE.Mesh {
    let mesh = stoneMeshes.get(record.id);
    const mat = stoneMaterial(record.player);
    const p = gomokuCellWorld(size, record.row, record.col);
    const yaw = yawForId(record.id);
    if (!mesh) {
      mesh = new THREE.Mesh(stoneGeo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      tagPieceForShadows(mesh, false);
      mesh.userData.shadow = makeShadow(yaw);
      stonesGroup.add(mesh);
      stoneMeshes.set(record.id, mesh);
    } else {
      mesh.material = mat;
    }
    mesh.rotation.y = yaw;
    (mesh.userData.shadow as THREE.Mesh).rotation.y = yaw;
    mesh.position.set(p.x, y, p.z);
    (mesh.userData.shadow as THREE.Mesh).position.set(p.x, shadowY, p.z);
    return mesh;
  }

  function clearWinLine() {
    winGroup.clear();
  }

  function drawWinLine(cells: { row: number; col: number }[]) {
    clearWinLine();
    if (cells.length < 2) return;
    const points = cells.map(c => {
      const p = gomokuCellWorld(size, c.row, c.col);
      return new THREE.Vector3(p.x, 0.012, p.z);
    });
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    disposables.push(geo);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: GOMOKU_WIN_ACCENT, linewidth: 2, transparent: true, opacity: 0.95 }),
    );
    winGroup.add(line);
    for (const c of cells) {
      const p = gomokuCellWorld(size, c.row, c.col);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(GOMOKU_DIMS.STONE_R * 0.72, GOMOKU_DIMS.STONE_R * 0.88, 32),
        new THREE.MeshBasicMaterial({ color: GOMOKU_WIN_ACCENT, side: THREE.DoubleSide, transparent: true, opacity: 0.35 }),
      );
      disposables.push(ring.geometry as THREE.BufferGeometry);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.011, p.z);
      winGroup.add(ring);
    }
  }

  function pickCell(clientX: number, clientY: number): { row: number; col: number } | null {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
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

  function render() {
    if (disposed) return;
    renderer.render(scene, camera);
  }

  function requestRender() {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      render();
    });
  }

  function updateGhost(row: number | null, col: number | null, player: ScenePlayer | null) {
    ghostGroup.clear();
    ghostMesh = null;
    if (row === null || col === null || !player) return;
    const mat = stoneMaterial(player).clone();
    mat.transparent = true;
    mat.opacity = themeId === 'dark' ? 0.38 : 0.32;
    ghostMesh = new THREE.Mesh(stoneGeo, mat);
    const p = gomokuCellWorld(size, row, col);
    ghostMesh.position.set(p.x, restY, p.z);
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
    const cell = pickCell(event.clientX, event.clientY);
    if (cell) pendingTap = { ...cell, x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent) {
    if (!pendingTap || event.button !== 0) return;
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
  controls.addEventListener('change', () => {
    syncBoardGridLines();
    requestRender();
  });

  let cameraViewsRef: CameraViewController | null = null;

  function gomokuFramePoints(): THREE.Vector3[] {
    const half = size / 2 + GOMOKU_DIMS.MARGIN * 0.65;
    const yTop = restY + 0.08;
    return [
      new THREE.Vector3(-half, 0, -half),
      new THREE.Vector3(half, 0, half),
      new THREE.Vector3(-half, yTop, half),
      new THREE.Vector3(half, yTop, -half),
    ];
  }

  function syncViewport() {
    const bounds = container.getBoundingClientRect();
    viewportW = Math.max(1, bounds.width);
    viewportH = Math.max(1, bounds.height);
    renderer.setSize(viewportW, viewportH, false);
    return viewportW / viewportH;
  }

  function fit() {
    syncViewport();
    if (cameraViewsRef) {
      cameraViewsRef.refit();
      syncBoardGridLines();
      render();
      return;
    }
    const aspect = viewportW / viewportH;
    const half = size / 2 + GOMOKU_DIMS.MARGIN * 0.65;
    const halfHeight = half * 1.08;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    syncBoardGridLines();
    boardLighting.fitToPoints(gomokuFramePoints());
    render();
  }

  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('bench')) {
    (window as unknown as { __benchOneFrame?: () => number }).__benchOneFrame = () =>
      measureBoardFrameMs(renderer, scene, camera);
  }

  const ro = new ResizeObserver(fit);
  ro.observe(container);
  fit();

  return {
    setTheme(id: ThemeId) {
      themeId = id;
      materials.board.dispose();
      materials.line.dispose();
      materials.star.dispose();
      materials.stoneA.dispose();
      materials.stoneB.dispose();
      materials.stoneShadow.dispose();
      materials = gomokuThemeMaterials(themeId);
      scene.background = materials.table.clone();
      rebuildBoardMesh();
      requestRender();
    },
    setStones(stones: StoneRecord[], winLine: { row: number; col: number }[] | null) {
      const keep = new Set(stones.map(s => s.id));
      for (const [id, mesh] of stoneMeshes) {
        if (!keep.has(id)) {
          stonesGroup.remove(mesh);
          shadowsGroup.remove(mesh.userData.shadow as THREE.Mesh);
          stoneMeshes.delete(id);
        }
      }
      for (const s of stones) upsertStone(s, restY);
      if (winLine?.length) drawWinLine(winLine);
      else clearWinLine();
      requestRender();
    },
    setHover(row, col, player) {
      updateGhost(row, col, player);
    },
    animateDrop(stone: StoneRecord) {
      const mesh = upsertStone(stone, restY + dropLift);
      const shadow = mesh.userData.shadow as THREE.Mesh;
      const start = performance.now();
      return new Promise<void>(resolve => {
        const tick = (now: number) => {
          const t = easeOutCubic(Math.min(1, (now - start) / DROP_MS));
          const y = THREE.MathUtils.lerp(restY + dropLift, restY, t);
          mesh.position.y = y;
          shadow.position.y = shadowY;
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
      cameraViewsRef?.dispose();
      disposed = true;
      ro.disconnect();
      controls.dispose();
      boardLighting.dispose();
      disposeEnvironment();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      renderer.domElement.remove();
      stoneGeo.dispose();
      for (const g of disposables) g.dispose();
    },
  };
}
