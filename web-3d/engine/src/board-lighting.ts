import * as THREE from 'three';
import { BOARD } from './constants';
import { PLAYFIELD_GROUND_USER_DATA } from './playfield-ground';

export interface BoardLightingOptions {
  /** Extra Y extent for stacked pieces in the shadow frustum. */
  pieceHeightMargin?: number;
}

export interface BoardLightingHandle {
  readonly light: THREE.DirectionalLight;
  fitToBox(box: THREE.Box3): void;
  fitToPoints(points: THREE.Vector3[]): void;
  refreshMapSize(): void;
  dispose(): void;
}

/** 45° elevation, 45° diagonal azimuth (shadows on the board fall at ~45°). */
const LIGHT_DIR = new THREE.Vector3(-1, Math.SQRT2, 1).normalize();

const BOX_CORNERS = Array.from({ length: 8 }, () => new THREE.Vector3());
const PLAYFIELD_CATCHER_NAME = '__playfieldShadowCatcher';
const playfieldBounds = new THREE.Box3();

function chooseShadowMapSize(): number {
  if (typeof window === 'undefined') return 2048;
  const dpr = window.devicePixelRatio || 1;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return mobile || dpr < 1.5 ? 1024 : 2048;
}

function applyShadowMapSettings(light: THREE.DirectionalLight, size: number) {
  light.shadow.mapSize.set(size, size);
  light.shadow.bias = -0.00028;
  light.shadow.normalBias = 0.018;
  light.shadow.radius = 1.5;
}

function fillBoxCorners(box: THREE.Box3, out: THREE.Vector3[]) {
  const { min, max } = box;
  const xs = [min.x, max.x];
  const ys = [min.y, max.y];
  const zs = [min.z, max.z];
  let i = 0;
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        out[i].set(x, y, z);
        i += 1;
      }
    }
  }
}

function fitShadowCameraToBox(light: THREE.DirectionalLight, box: THREE.Box3, pad: number) {
  light.updateMatrixWorld(true);
  light.target.updateMatrixWorld(true);
  light.shadow.updateMatrices(light);

  const cam = light.shadow.camera as THREE.OrthographicCamera;
  fillBoxCorners(box, BOX_CORNERS);

  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const corner of BOX_CORNERS) {
    corner.applyMatrix4(cam.matrixWorldInverse);
    min.min(corner);
    max.max(corner);
  }

  cam.left = min.x - pad;
  cam.right = max.x + pad;
  cam.bottom = min.y - pad;
  cam.top = max.y + pad;
  cam.near = Math.max(0.1, min.z - pad);
  cam.far = max.z + pad;
  cam.updateProjectionMatrix();
  light.shadow.needsUpdate = true;
}

/** Shared directional sun + shadow map (engine-only; demos must not add lights). */
export function applyBoardLighting(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  options: BoardLightingOptions = {},
): BoardLightingHandle {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pieceHeightMargin = options.pieceHeightMargin ?? 1.35;
  const light = new THREE.DirectionalLight(0xffffff, 1.05);
  light.position.set(-7, 11, 8);
  light.castShadow = true;
  applyShadowMapSettings(light, chooseShadowMapSize());

  const target = new THREE.Object3D();
  target.position.set(0, 0, 0);
  scene.add(target);
  light.target = target;
  scene.add(light);

  const tmpBox = new THREE.Box3();

  function fitToBox(box: THREE.Box3) {
    tmpBox.copy(box);
    if (tmpBox.isEmpty()) {
      tmpBox.set(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, pieceHeightMargin, 4));
    }
    tmpBox.min.y = Math.min(tmpBox.min.y, BOARD.PLAYFIELD_SURFACE_Y);
    tmpBox.max.y = Math.max(tmpBox.max.y, BOARD.PLAYFIELD_SURFACE_Y + pieceHeightMargin);
    tmpBox.expandByScalar(0.35);

    const center = tmpBox.getCenter(new THREE.Vector3());
    const size = tmpBox.getSize(new THREE.Vector3());
    const lightDistance = Math.max(14, size.y + 12);

    target.position.copy(center);
    light.position.copy(center).addScaledVector(LIGHT_DIR, lightDistance);

    const pad = Math.max(0.2, Math.max(size.x, size.z) * 0.04);
    fitShadowCameraToBox(light, tmpBox, pad);
  }

  function fitToPoints(points: THREE.Vector3[]) {
    if (!points.length) {
      fitToBox(new THREE.Box3(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, 1, 4)));
      return;
    }
    tmpBox.makeEmpty();
    for (const p of points) tmpBox.expandByPoint(p);
    fitToBox(tmpBox);
  }

  fitToBox(new THREE.Box3(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, 1, 4)));

  return {
    light,
    fitToBox,
    fitToPoints,
    refreshMapSize() {
      applyShadowMapSettings(light, chooseShadowMapSize());
      light.shadow.needsUpdate = true;
    },
    dispose() {
      scene.remove(light);
      scene.remove(target);
      light.dispose();
    },
  };
}

export function setMeshShadowFlags(
  root: THREE.Object3D,
  flags: { cast?: boolean; receive?: boolean },
  filter?: (mesh: THREE.Mesh) => boolean,
) {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (filter && !filter(node)) return;
    if (flags.cast !== undefined) node.castShadow = flags.cast;
    if (flags.receive !== undefined) node.receiveShadow = flags.receive;
  });
}

/** Drop-shadow strength on unlit (MeshBasic) boards. */
export const PIECE_DROP_SHADOW_OPACITY = 0.38;

function createPlayfieldShadowCatcher(): THREE.Mesh {
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({
      opacity: PIECE_DROP_SHADOW_OPACITY,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  catcher.name = PLAYFIELD_CATCHER_NAME;
  catcher.rotation.x = -Math.PI / 2;
  catcher.userData.isShadowCatcher = true;
  catcher.receiveShadow = true;
  catcher.castShadow = false;
  catcher.renderOrder = 0;
  catcher.raycast = () => {};
  return catcher;
}

function syncPlayfieldShadowCatcher(boardRoot: THREE.Object3D) {
  boardRoot.updateMatrixWorld(true);
  playfieldBounds.makeEmpty();
  boardRoot.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node.userData.isShadowCatcher) return;
    if (node.userData[PLAYFIELD_GROUND_USER_DATA]) return;
    playfieldBounds.expandByObject(node);
  });
  if (playfieldBounds.isEmpty()) return;

  let catcher = boardRoot.getObjectByName(PLAYFIELD_CATCHER_NAME) as THREE.Mesh | undefined;
  if (!catcher) {
    catcher = createPlayfieldShadowCatcher();
    boardRoot.add(catcher);
  }

  const center = playfieldBounds.getCenter(new THREE.Vector3());
  const size = playfieldBounds.getSize(new THREE.Vector3());
  const pad = 0.12;
  catcher.position.set(center.x, BOARD.PLAYFIELD_SURFACE_Y + 0.0008, center.z);
  catcher.scale.set(Math.max(size.x, 0.5) + pad * 2, Math.max(size.z, 0.5) + pad * 2, 1);
}

/** Playfield receives directional shadows; thin grid lines and decals do not. */
export function tagPlayfieldForShadows(boardRoot: THREE.Object3D) {
  setMeshShadowFlags(boardRoot, { cast: false, receive: false });
  syncPlayfieldShadowCatcher(boardRoot);
  boardRoot.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node.userData.boardGridLine || node.userData.isShadowCatcher) return;
    if (node.userData[PLAYFIELD_GROUND_USER_DATA]) {
      node.receiveShadow = true;
      return;
    }
    node.receiveShadow = false;
  });
}

export function tagPieceForShadows(root: THREE.Object3D, receiveInStack: boolean) {
  setMeshShadowFlags(root, { cast: true, receive: receiveInStack });
  root.traverse(node => {
    if (node instanceof THREE.LineSegments) {
      node.castShadow = false;
      node.receiveShadow = false;
    }
  });
}
