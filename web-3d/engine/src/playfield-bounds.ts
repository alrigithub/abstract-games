import * as THREE from 'three';
import { PLAYFIELD_GROUND_USER_DATA } from './playfield-ground';

/** When true, object (and its subtree) is omitted from camera fit, zoom limits, and shadow layout bounds. */
export const EXCLUDE_FROM_BOUNDS = 'excludeFromBounds' as const;

export function tagExcludeFromBounds(object: THREE.Object3D): void {
  object.userData[EXCLUDE_FROM_BOUNDS] = true;
}

export function isExcludedFromBounds(object: THREE.Object3D): boolean {
  return (
    object.userData[EXCLUDE_FROM_BOUNDS] === true ||
    object.userData[PLAYFIELD_GROUND_USER_DATA] === true ||
    object.userData.isShadowCatcher === true
  );
}

const _meshBox = new THREE.Box3();

/** Expand `box` with visible playfield meshes under `root`, skipping excluded subtrees. */
export function expandBoxByPlayfieldContent(
  box: THREE.Box3,
  root: THREE.Object3D,
  precise = false,
): void {
  const visit = (node: THREE.Object3D) => {
    if (node !== root && isExcludedFromBounds(node)) return;
    if ((node as THREE.Mesh).isMesh) {
      _meshBox.setFromObject(node, precise);
      if (!_meshBox.isEmpty()) box.union(_meshBox);
      return;
    }
    for (const child of node.children) visit(child);
  };
  visit(root);
}

export function box3FromPlayfieldContent(root: THREE.Object3D, precise = false): THREE.Box3 {
  const box = new THREE.Box3();
  expandBoxByPlayfieldContent(box, root, precise);
  return box;
}

/** Corner samples on the XZ extent of `box` (for orthographic framing / shadow fit). */
export function box3CornerPoints(
  box: THREE.Box3,
  pad = 0,
  yBottom = 0,
  yTop?: number,
): THREE.Vector3[] {
  if (box.isEmpty()) return [];
  const yMax = yTop ?? Math.max(box.max.y, yBottom + 0.5);
  const points: THREE.Vector3[] = [];
  for (const x of [box.min.x - pad, box.max.x + pad]) {
    for (const z of [box.min.z - pad, box.max.z + pad]) {
      points.push(new THREE.Vector3(x, yBottom, z), new THREE.Vector3(x, yMax, z));
    }
  }
  return points;
}

/** Default playable grid corners in world space (cell centres ± half-cell margin). */
export function squareGridFrameCorners(gridSize: number, outsideRows = 0, yTop = 1.2): THREE.Vector3[] {
  const half = gridSize / 2 + outsideRows + 0.04;
  const points: THREE.Vector3[] = [];
  for (const x of [-half, half]) {
    for (const z of [-half, half]) {
      points.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, yTop, z));
    }
  }
  return points;
}
