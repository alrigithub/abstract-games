import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  BOARD,
  CAMERA,
  GIPF_CHIP,
  createCameraViewController,
  createGameButtons,
  createGipfChipGeometry,
  createGipfHexBoard,
  createTzaarHexTopology,
  createTzaarPieceMesh,
  gipfLayoutFrameCorners,
  readInitialTheme,
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

const labels: StackLabel[] = [];

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

let frame = 0;
let framed = false;
let viewportW = 1;
let viewportH = 1;
function requestRender() {
  if (!document.hidden && !frame) frame = requestAnimationFrame(render);
}
function projectLabels() {
  const bounds = boardEl.getBoundingClientRect();
  for (const label of labels) {
    const p = label.world.clone().project(camera);
    label.el.style.left = `${(p.x * 0.5 + 0.5) * bounds.width}px`;
    label.el.style.top = `${(-p.y * 0.5 + 0.5) * bounds.height}px`;
  }
}
function render() {
  frame = 0;
  if (document.hidden) return;
  renderer.render(scene, camera);
  projectLabels();
}

controls.addEventListener('change', requestRender);

function tzaarFramePoints(): THREE.Vector3[] {
  return (topology.frameCorners?.(snapshot) ?? gipfLayoutFrameCorners(layout)).map(p => p.clone());
}

const cameraViews = createCameraViewController({
  camera,
  controls,
  getBounds: tzaarFramePoints,
  getAspect: () => viewportW / viewportH,
  onUpdate: requestRender,
});
framed = true;

function fit() {
  const bounds = boardEl.getBoundingClientRect();
  viewportW = Math.max(1, Math.round(bounds.width));
  viewportH = Math.max(1, Math.round(bounds.height));
  renderer.setSize(viewportW, viewportH, true);
  cameraViews.refit();
  requestRender();
}

function applyTheme(id: ThemeId) {
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
    opacity: 0.09,
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
    shadow.scale.set(BOARD.SHADOW_SCALE, 0.001, BOARD.SHADOW_SCALE);
    shadow.position.set(pos.x, surface + BOARD.SHADOW_CONTACT_EPSILON, pos.z);
    shadow.renderOrder = 1;
    shadowsRoot.add(shadow);
    if (height >= 2) {
      const el = document.createElement('span');
      el.className = 'stack-height';
      el.textContent = String(height);
      el.dataset.testid = `stack-height-${piece.x}-${piece.y}`;
      boardEl.appendChild(el);
      labels.push({ el, world: new THREE.Vector3(pos.x, y + 0.02, pos.z) });
    }
  }
  requestRender();
}

const initial: ThemeId = readInitialTheme();
applyTheme(initial);

createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  cameraViews,
  applyTheme,
  onNewGameReset: () => applyTheme(initial),
});

fit();

const resize = new ResizeObserver(() => fit());
resize.observe(boardEl);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) requestRender();
});
