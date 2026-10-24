import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  BOARD,
  CAMERA,
  GIPF_CHIP,
  createGameButtons,
  createGipfChipGeometry,
  createGipfHexBoard,
  createTzaarHexTopology,
  createTzaarPieceMesh,
  gipfLayoutFrameCorners,
  readStoredTheme,
  tzaarFixedStart,
  tzaarLayout,
  tzaarPlayableCells,
  themeTokens,
  type ThemeId,
} from '@abstract/three-engine';

/** Official start plus a few mid-board stacks so height reads at a glance. */
const STACKS: Record<string, number> = {
  '3,2': 5,
  '6,4': 4,
  '2,4': 3,
  '4,6': 5,
  '1,1': 2,
  '7,7': 4,
  '0,0': 3,
  '8,8': 2,
};

const params = new URLSearchParams(location.search);
const requested = params.get('theme');

const boardEl = document.querySelector<HTMLDivElement>('#board')!;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.domElement.setAttribute('aria-hidden', 'true');
renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
boardEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, CAMERA.near, CAMERA.far);
camera.position.set(...CAMERA.position);
camera.lookAt(0, 0, 0);

const boardRoot = new THREE.Group();
const piecesRoot = new THREE.Group();
const shadowsRoot = new THREE.Group();
scene.add(boardRoot, shadowsRoot, piecesRoot);

const layout = tzaarLayout();
const topology = createTzaarHexTopology();
const cells = tzaarPlayableCells();
const start = tzaarFixedStart();
const snapshot = {
  playableCells: cells.length,
  cellCount: cells.length,
  cells: cells.map(() => []),
};
const discGeo = createGipfChipGeometry();

interface StackLabel {
  el: HTMLSpanElement;
  world: THREE.Vector3;
}

const labelScratch = new THREE.Vector3();
const LABEL_RIM_SAMPLES = 16;
const LABEL_GAP_PX = 22;

const labels: StackLabel[] = [];

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
controls.touches.ONE = THREE.TOUCH.PAN;
controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

let frame = 0;
let framed = false;
function requestRender() {
  if (!document.hidden && !frame) frame = requestAnimationFrame(render);
}
function projectLabels() {
  const bounds = boardEl.getBoundingClientRect();
  const w = bounds.width;
  const h = bounds.height;
  const radius = GIPF_CHIP.RADIUS;
  for (const label of labels) {
    const p = label.world.clone().project(camera);
    const cx = (p.x * 0.5 + 0.5) * w;
    let topY = (-p.y * 0.5 + 0.5) * h;
    for (let i = 0; i < LABEL_RIM_SAMPLES; i++) {
      const a = (i / LABEL_RIM_SAMPLES) * Math.PI * 2;
      labelScratch.set(label.world.x + Math.cos(a) * radius, label.world.y, label.world.z + Math.sin(a) * radius);
      labelScratch.project(camera);
      topY = Math.min(topY, (-labelScratch.y * 0.5 + 0.5) * h);
    }
    label.el.style.left = `${cx}px`;
    label.el.style.top = `${topY - LABEL_GAP_PX}px`;
  }
}
function render() {
  frame = 0;
  if (document.hidden) return;
  renderer.render(scene, camera);
  projectLabels();
}

controls.addEventListener('change', requestRender);

function fit(reframe = false) {
  const bounds = boardEl.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  renderer.setSize(width, height, true);
  const aspect = width / height;
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
  const points = topology.frameCorners?.(snapshot) ?? gipfLayoutFrameCorners(layout);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    point.applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect)) * 1.08;
  camera.left = centerX - halfHeight * aspect;
  camera.right = centerX + halfHeight * aspect;
  camera.top = centerY + halfHeight;
  camera.bottom = centerY - halfHeight;
  camera.updateProjectionMatrix();
  requestRender();
}

let theme: ThemeId = requested === 'light' || requested === 'dark' ? requested : readStoredTheme();
document.documentElement.dataset.theme = theme;

function applyTheme(id: ThemeId) {
  theme = id;
  document.documentElement.dataset.theme = id;
  const tokens = themeTokens(id);
  scene.background = new THREE.Color(tokens.table);
  boardRoot.clear();
  boardRoot.add(createGipfHexBoard(layout, tokens));
  piecesRoot.clear();
  shadowsRoot.clear();
  for (const label of labels) label.el.remove();
  labels.length = 0;
  const edgeCache = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();
  const shadowMat = new THREE.MeshBasicMaterial({
    color: tokens.shadow,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const surface = BOARD.PLAYFIELD_SURFACE_Y;
  for (const piece of start) {
    const height = STACKS[`${piece.x},${piece.y}`] ?? 1;
    const pos = topology.cellPosition(piece.index, snapshot);
    let y = surface;
    for (let level = 0; level < height; level++) {
      const isTop = level === height - 1;
      const mesh = createTzaarPieceMesh({
        player: piece.player,
        kind: isTop ? piece.kind : 'tott',
        isTop,
        tokens,
        edgeCache,
        showSeparator: level > 0,
      });
      mesh.position.set(pos.x, y + GIPF_CHIP.HEIGHT / 2, pos.z);
      piecesRoot.add(mesh);
      y += GIPF_CHIP.HEIGHT;
    }
    const shadow = new THREE.Mesh(discGeo, shadowMat);
    shadow.scale.set(BOARD.CONTACT_BLOB_SOFT_SCALE, 0.001, BOARD.CONTACT_BLOB_SOFT_SCALE);
    shadow.position.set(pos.x, surface + BOARD.SHADOW_CONTACT_EPSILON, pos.z);
    shadow.renderOrder = 1;
    shadowsRoot.add(shadow);
    if (height >= 2) {
      const el = document.createElement('span');
      el.className = 'stack-height';
      el.textContent = String(height);
      el.dataset.testid = `stack-height-${piece.x}-${piece.y}`;
      boardEl.appendChild(el);
      labels.push({ el, world: new THREE.Vector3(pos.x, y + GIPF_CHIP.HEIGHT * 0.35, pos.z) });
    }
  }
  requestRender();
}

function renderStatus(extra?: string) {
  gameButtons.setStatus(extra ?? 'Tzaar piece demo · official start (no 3D AI yet)');
}

const gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  applyTheme,
  onNewGameReset: () => {
    applyTheme(theme);
    renderStatus('Demo layout reset');
  },
});

if (requested === 'light' || requested === 'dark') applyTheme(requested);
else applyTheme(theme);
renderStatus();
fit();

const resize = new ResizeObserver(() => fit());
resize.observe(boardEl);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) requestRender();
});
