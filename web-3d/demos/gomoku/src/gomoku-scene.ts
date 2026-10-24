import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  CAMERA,
  GOMOKU_DIMS,
  createContactShadowBlob,
  createGoBowlGeometry,
  createGomokuStoneGeometry,
  gomokuCellWorld,
  gomokuHoshiPoints,
  gomokuThemeMaterials,
  type ThemeId,
} from '@abstract/three-engine';

export interface GomokuSceneOptions {
  theme?: ThemeId;
}

export interface GomokuSceneApi {
  setTheme(id: ThemeId): void;
  dispose(): void;
}

export function createGomokuScene(container: HTMLElement, options: GomokuSceneOptions = {}): GomokuSceneApi {
  let themeId: ThemeId = options.theme ?? 'light';
  let materials = gomokuThemeMaterials(themeId);

  const size = GOMOKU_DIMS.GRID;
  const stoneGeo = createGomokuStoneGeometry();
  const bowlGeo = createGoBowlGeometry();

  const scene = new THREE.Scene();
  scene.background = materials.table.clone();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.position);
  camera.lookAt(0, 0, 0);

  const root = new THREE.Group();
  const boardGroup = new THREE.Group();
  const stonesGroup = new THREE.Group();
  const bowlsGroup = new THREE.Group();
  root.add(boardGroup, bowlsGroup, stonesGroup);
  scene.add(root);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(6, 14, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-8, 6, -4);
  scene.add(fill);

  const disposables: THREE.BufferGeometry[] = [];
  const meshes: THREE.Mesh[] = [];

  function lineMesh(w: number, d: number): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(w, d);
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, materials.line);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  function rebuildBoard() {
    boardGroup.clear();
    bowlsGroup.clear();
    stonesGroup.clear();
    meshes.length = 0;

    const span = size - 1;
    const boardSpan = span + GOMOKU_DIMS.MARGIN * 2;
    const slab = new THREE.BoxGeometry(boardSpan, GOMOKU_DIMS.SLAB, boardSpan);
    disposables.push(slab);
    const slabMesh = new THREE.Mesh(slab, materials.board);
    slabMesh.position.y = -GOMOKU_DIMS.SLAB / 2;
    boardGroup.add(slabMesh);

    const blob = createContactShadowBlob(boardSpan * 0.92);
    blob.material = materials.contactShadow;
    boardGroup.add(blob);

    const yLine = 0.003;
    for (let i = 0; i < size; i++) {
      const offset = i - span / 2;
      const h = lineMesh(GOMOKU_DIMS.LINE_W, span);
      h.position.set(offset, yLine, 0);
      boardGroup.add(h);
      const v = lineMesh(span, GOMOKU_DIMS.LINE_W);
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

    const edgeGeo = new THREE.EdgesGeometry(slab, 12);
    disposables.push(edgeGeo);
    const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: materials.line.color }));
    edges.position.copy(slabMesh.position);
    boardGroup.add(edges);

    placeSampleStones();
    buildBowls();
  }

  function addStone(x: number, z: number, player: 'A' | 'B', id: string) {
    const mat = player === 'A' ? materials.stoneA : materials.stoneB;
    const mesh = new THREE.Mesh(stoneGeo, mat);
    mesh.position.set(x, GOMOKU_DIMS.FLOOR + GOMOKU_DIMS.STONE_H / 2, z);
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    mesh.rotation.y = ((hash >>> 0) % 1000) / 1000 * (Math.PI / 8);
    stonesGroup.add(mesh);
    meshes.push(mesh);

    const shadow = new THREE.Mesh(
      stoneGeo,
      new THREE.MeshBasicMaterial({
        color: materials.contactShadow.color,
        transparent: true,
        opacity: themeId === 'dark' ? 0.35 : 0.14,
        depthWrite: false,
      }),
    );
    shadow.scale.set(1.04, 0.0012, 1.04);
    shadow.position.set(x, GOMOKU_DIMS.FLOOR + 0.006, z);
    shadow.rotation.y = mesh.rotation.y;
    stonesGroup.add(shadow);
  }

  function placeSampleStones() {
    const layout: { row: number; col: number; player: 'A' | 'B'; id: string }[] = [
      { row: 7, col: 7, player: 'B', id: 'b0' },
      { row: 7, col: 8, player: 'A', id: 'w0' },
      { row: 8, col: 7, player: 'B', id: 'b1' },
      { row: 8, col: 8, player: 'A', id: 'w1' },
    ];
    for (const s of layout) {
      const p = gomokuCellWorld(size, s.row, s.col);
      addStone(p.x, p.z, s.player, s.id);
    }
  }

  function stackStonesInBowl(sign: -1 | 1, player: 'A' | 'B') {
    const cx = sign * GOMOKU_DIMS.BOWL_X;
    const mat = player === 'A' ? materials.stoneA : materials.stoneB;
    const count = GOMOKU_DIMS.RESERVE_VISUAL;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(stoneGeo, mat);
      const jitter = ((i * 17) % 11) / 11 - 0.5;
      mesh.position.set(cx + jitter * 0.08, 0.34 + i * 0.018, jitter * 0.06);
      mesh.rotation.y = i * 0.31;
      bowlsGroup.add(mesh);
    }
  }

  function buildBowls() {
    for (const sign of [-1, 1] as const) {
      const bowl = new THREE.Mesh(bowlGeo, materials.bowl);
      bowl.position.set(sign * GOMOKU_DIMS.BOWL_X, 0, 0);
      bowlsGroup.add(bowl);
      stackStonesInBowl(sign, sign < 0 ? 'B' : 'A');
    }
  }

  rebuildBoard();

  const controls = new OrbitControls(camera, renderer.domElement);
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

  let frame = 0;
  let disposed = false;

  function fit() {
    const bounds = container.getBoundingClientRect();
    const w = Math.max(1, bounds.width);
    const h = Math.max(1, bounds.height);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const half = size / 2 + GOMOKU_DIMS.BOWL_X * 0.55;
    const halfHeight = half * 1.05;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    render();
  }

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

  controls.addEventListener('change', requestRender);
  const ro = new ResizeObserver(fit);
  ro.observe(container);
  fit();

  return {
    setTheme(id: ThemeId) {
      themeId = id;
      materials.board.dispose();
      materials.line.dispose();
      materials.star.dispose();
      materials.bowl.dispose();
      materials.stoneA.dispose();
      materials.stoneB.dispose();
      materials.contactShadow.dispose();
      materials = gomokuThemeMaterials(themeId);
      scene.background = materials.table.clone();
      rebuildBoard();
      requestRender();
    },
    dispose() {
      disposed = true;
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stoneGeo.dispose();
      bowlGeo.dispose();
      for (const g of disposables) g.dispose();
    },
  };
}
