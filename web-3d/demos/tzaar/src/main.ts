import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ANIMATION,
  CAMERA,
  TZAAR_DISC_HEIGHT,
  TZAAR_DISC_RADIUS,
  createTzaarBoardGroup,
  createTzaarHeightBadge,
  createTzaarHexTopology,
  createTzaarPieceMesh,
  readStoredTheme,
  storeTheme,
  tzaarBoardExtent,
  tzaarFixedStart,
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
let themeId: ThemeId = requested === 'light' || requested === 'dark' ? requested : readStoredTheme();

const boardEl = document.querySelector<HTMLDivElement>('#board')!;
document.documentElement.dataset.theme = themeId;

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
scene.add(boardRoot, piecesRoot);

const topology = createTzaarHexTopology();
const cells = tzaarPlayableCells();
const start = tzaarFixedStart();
const snapshot = {
  playableCells: cells.length,
  cellCount: cells.length,
  cells: cells.map(() => []),
};

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
function render() {
  frame = 0;
  if (document.hidden) return;
  renderer.render(scene, camera);
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
  const half = tzaarBoardExtent() / 2;
  const points = [
    new THREE.Vector3(-half, 0, -half),
    new THREE.Vector3(half, 0, -half),
    new THREE.Vector3(-half, 0, half),
    new THREE.Vector3(half, 0, half),
  ];
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
  const halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect)) * CAMERA.framePadding;
  camera.left = centerX - halfHeight * aspect;
  camera.right = centerX + halfHeight * aspect;
  camera.top = centerY + halfHeight;
  camera.bottom = centerY - halfHeight;
  camera.updateProjectionMatrix();
  requestRender();
}

function applyTheme(id: ThemeId) {
  themeId = id;
  document.documentElement.dataset.theme = id;
  const tokens = themeTokens(id);
  scene.background = new THREE.Color(tokens.table);
  boardRoot.clear();
  boardRoot.add(createTzaarBoardGroup(tokens));
  piecesRoot.clear();
  const edgeCache = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();
  for (const piece of start) {
    const height = STACKS[`${piece.x},${piece.y}`] ?? 1;
    const pos = topology.cellPosition(piece.index, snapshot);
    let y = ANIMATION.FLOOR;
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
      mesh.position.set(pos.x, y + TZAAR_DISC_HEIGHT / 2, pos.z);
      piecesRoot.add(mesh);
      y += TZAAR_DISC_HEIGHT;
    }
    if (height >= 2) {
      const badge = createTzaarHeightBadge(height, tokens, piece.player);
      const outward = new THREE.Vector3(pos.x, 0, pos.z);
      if (outward.lengthSq() < 0.01) outward.set(1, 0, 0);
      outward.normalize().multiplyScalar(TZAAR_DISC_RADIUS + 0.28);
      badge.position.set(pos.x + outward.x, y * 0.5 + 0.08, pos.z + outward.z);
      badge.lookAt(camera.position);
      piecesRoot.add(badge);
    }
  }
  requestRender();
}

applyTheme(themeId);
fit();

document.querySelector('#theme-toggle')!.addEventListener('click', () => {
  const next: ThemeId = themeId === 'light' ? 'dark' : 'light';
  storeTheme(next);
  applyTheme(next);
});

const resize = new ResizeObserver(() => fit());
resize.observe(boardEl);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) requestRender();
});
