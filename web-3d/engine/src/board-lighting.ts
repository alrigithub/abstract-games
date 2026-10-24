import * as THREE from 'three';
import { BOARD, CLAY } from './constants';
import { expandBoxByPlayfieldContent, tagExcludeFromBounds } from './playfield-bounds';
import { PLAYFIELD_GROUND_USER_DATA } from './playfield-ground';
import { themeTokens, type ThemeId } from './theme';
import { ARENA_SHADOW_USER_DATA } from './board-arena-glb';

export interface BoardLightingOptions {
  /** Extra Y extent for stacked pieces in the shadow frustum. */
  pieceHeightMargin?: number;
  /**
   * Subtle hemisphere fill so PBR arena GLBs read with depth under the shared sun.
   * Flat MeshBasic boards leave this off (default).
   */
  ambientFill?: boolean;
}

export interface BoardLightingHandle {
  readonly light: THREE.DirectionalLight;
  fitToBox(box: THREE.Box3): void;
  fitToPoints(points: THREE.Vector3[]): void;
  refreshMapSize(): void;
  /** Sync hemisphere fill colours when the document theme changes (no-op if fill disabled). */
  syncThemeAmbientFill(themeId: ThemeId): void;
  dispose(): void;
}

/** 45° elevation, 45° azimuth — rotated 180° about Y to match baked piece shadow direction. */
const LIGHT_DIR = new THREE.Vector3(1, Math.SQRT2, -1).normalize();

const BOX_CORNERS = Array.from({ length: 8 }, () => new THREE.Vector3());
const PLAYFIELD_CATCHER_NAME = '__playfieldShadowCatcher';
const SCENE_SHADOW_CATCHER_NAME = '__sceneShadowCatcher';
const playfieldBounds = new THREE.Box3();

function boardShadowMapType(): THREE.ShadowMapType {
  return CLAY.SHADOW_MAP_TYPE === 'vsm' ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
}

function chooseShadowMapSize(): number {
  return CLAY.SHADOW_MAP_SIZE;
}

function applyShadowMapSettings(light: THREE.DirectionalLight, size: number) {
  light.shadow.mapSize.set(size, size);
  light.shadow.bias = CLAY.SHADOW_BIAS;
  light.shadow.normalBias = CLAY.SHADOW_NORMAL_BIAS;
  light.shadow.radius = CLAY.SHADOW_RADIUS;
  light.shadow.blurSamples = CLAY.SHADOW_BLUR_SAMPLES;
}

export function configureBoardShadowMap(renderer: THREE.WebGLRenderer): void {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = boardShadowMapType();
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
  // View space looks down -Z: depth along the light is -z, so near/far come from -max.z / -min.z.
  cam.near = Math.max(0.1, -max.z - pad);
  cam.far = Math.max(cam.near + 0.5, -min.z + pad);
  cam.updateProjectionMatrix();
  light.shadow.needsUpdate = true;
}

/** Shared directional sun + shadow map (engine-only; demos must not add lights). */
export function applyBoardLighting(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  options: BoardLightingOptions = {},
): BoardLightingHandle {
  configureBoardShadowMap(renderer);

  const pieceHeightMargin = options.pieceHeightMargin ?? 1.35;
  const light = new THREE.DirectionalLight(CLAY.KEY_LIGHT_COLOR, CLAY.KEY_LIGHT_INTENSITY);
  light.position.set(7, 11, -8);
  light.castShadow = true;
  applyShadowMapSettings(light, chooseShadowMapSize());

  const target = new THREE.Object3D();
  target.position.set(0, 0, 0);
  scene.add(target);
  light.target = target;
  scene.add(light);

  let hemisphere: THREE.HemisphereLight | null = null;
  if (options.ambientFill) {
    hemisphere = new THREE.HemisphereLight(0xffffff, 0x888880, 0.3);
    scene.add(hemisphere);
  }

  const tmpBox = new THREE.Box3();

  function syncThemeAmbientFill(themeId: ThemeId) {
    if (!hemisphere) return;
    const tokens = themeTokens(themeId);
    if (themeId === 'light') {
      // Neutral fill — avoids warm double-tint on authored sage PBR tiles.
      hemisphere.color.set('#ffffff');
      hemisphere.groundColor.set('#dcdcdc');
      hemisphere.intensity = 0.34;
      return;
    }
    const sky = new THREE.Color(CLAY.ENV_DARK);
    const ground = new THREE.Color(CLAY.BACKDROP);
    hemisphere.color.copy(sky);
    hemisphere.groundColor.copy(ground);
    hemisphere.intensity = 0.36;
  }
  syncThemeAmbientFill('light');

  function fitToBox(box: THREE.Box3) {
    tmpBox.copy(box);
    if (tmpBox.isEmpty()) {
      tmpBox.set(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, pieceHeightMargin, 4));
    }
    tmpBox.min.y = Math.min(tmpBox.min.y, BOARD.PLAYFIELD_SURFACE_Y);
    tmpBox.max.y = Math.max(tmpBox.max.y, BOARD.PLAYFIELD_SURFACE_Y + pieceHeightMargin);
    tmpBox.expandByScalar(CLAY.SHADOW_FRUSTUM_EXPAND);

    const center = tmpBox.getCenter(new THREE.Vector3());
    const size = tmpBox.getSize(new THREE.Vector3());
    const lightDistance = Math.max(14, size.y + 12);

    target.position.copy(center);
    light.position.copy(center).addScaledVector(LIGHT_DIR, lightDistance);

    const pad = Math.max(
      CLAY.SHADOW_FRUSTUM_PAD_MIN,
      Math.max(size.x, size.z) * CLAY.SHADOW_FRUSTUM_PAD_XZ_RATIO,
    );
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
    syncThemeAmbientFill,
    dispose() {
      scene.remove(light);
      scene.remove(target);
      light.dispose();
      if (hemisphere) {
        scene.remove(hemisphere);
        hemisphere.dispose();
      }
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
export const PIECE_DROP_SHADOW_OPACITY = 0.28;

function createPlayfieldShadowCatcher(): THREE.Mesh {
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: PIECE_DROP_SHADOW_OPACITY,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  catcher.name = PLAYFIELD_CATCHER_NAME;
  catcher.rotation.x = -Math.PI / 2;
  catcher.userData.isShadowCatcher = true;
  tagExcludeFromBounds(catcher);
  catcher.receiveShadow = true;
  catcher.castShadow = false;
  catcher.renderOrder = 6;
  catcher.raycast = () => {};
  return catcher;
}

function ensurePlayfieldShadowCatcher(boardRoot: THREE.Object3D): THREE.Mesh {
  let catcher = boardRoot.getObjectByName(PLAYFIELD_CATCHER_NAME) as THREE.Mesh | undefined;
  if (!catcher) {
    catcher = createPlayfieldShadowCatcher();
    boardRoot.add(catcher);
  }
  return catcher;
}

function layoutPlayfieldShadowCatcher(catcher: THREE.Mesh, bounds: THREE.Box3, pad: number) {
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  catcher.position.set(center.x, BOARD.LINE_Y + 0.004, center.z);
  catcher.scale.set(Math.max(size.x, 0.5) + pad * 2, Math.max(size.z, 0.5) + pad * 2, 1);
}

function syncPlayfieldShadowCatcher(boardRoot: THREE.Object3D) {
  boardRoot.updateMatrixWorld(true);
  playfieldBounds.makeEmpty();
  expandBoxByPlayfieldContent(playfieldBounds, boardRoot);
  if (playfieldBounds.isEmpty()) return;
  layoutPlayfieldShadowCatcher(ensurePlayfieldShadowCatcher(boardRoot), playfieldBounds, 0.12);
}

/** Size the board shadow receiver to visible playfield XZ bounds (includes reserves / margins). */
export function fitPlayfieldShadowCatcher(boardRoot: THREE.Object3D, worldBounds: THREE.Box3, pad = 0.35) {
  const catcher = ensurePlayfieldShadowCatcher(boardRoot);
  layoutPlayfieldShadowCatcher(catcher, worldBounds, pad);
}

/** Full-scene shadow receiver (covers reserves / margins outside the board group). */
export function syncSceneShadowCatcher(scene: THREE.Scene, worldBounds: THREE.Box3, pad = 0.5) {
  if (!CLAY.USE_SCENE_SHADOW_CATCHER) {
    const existing = scene.getObjectByName(SCENE_SHADOW_CATCHER_NAME) as THREE.Mesh | undefined;
    if (existing) {
      scene.remove(existing);
      existing.geometry.dispose();
      (existing.material as THREE.Material).dispose();
    }
    return;
  }
  let catcher = scene.getObjectByName(SCENE_SHADOW_CATCHER_NAME) as THREE.Mesh | undefined;
  if (!catcher) {
    catcher = createPlayfieldShadowCatcher();
    catcher.name = SCENE_SHADOW_CATCHER_NAME;
    scene.add(catcher);
  }
  layoutPlayfieldShadowCatcher(catcher, worldBounds, pad);
}

/** Playfield receives directional shadows; thin grid lines and decals do not. */
export function tagPlayfieldForShadows(boardRoot: THREE.Object3D) {
  // Arena meshes have deliberate per-mesh flags; a board rebuild must not
  // erase their receivers or the shadows cast by columns and broken walls.
  setMeshShadowFlags(boardRoot, { cast: false, receive: false }, mesh => !mesh.userData[ARENA_SHADOW_USER_DATA]);
  boardRoot.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node.userData[ARENA_SHADOW_USER_DATA]) return;
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

/** Hint / placement ghosts must not cast directional shadows. */
export function tagGhostForShadows(root: THREE.Object3D) {
  setMeshShadowFlags(root, { cast: false, receive: false });
}
