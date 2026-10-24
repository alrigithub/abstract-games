import * as THREE from 'three';
import { BOARD } from '../constants';

let contactShadowTexture: THREE.CanvasTexture | null = null;

function pieceContactShadowTexture(): THREE.CanvasTexture {
  if (contactShadowTexture) return contactShadowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.65)');
  g.addColorStop(0.4, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  contactShadowTexture = new THREE.CanvasTexture(canvas);
  contactShadowTexture.colorSpace = THREE.SRGBColorSpace;
  return contactShadowTexture;
}

export function decoratePieceMesh(
  mesh: THREE.Mesh,
  edgeMaterial: THREE.LineBasicMaterial,
  outlineMaterial: THREE.MeshBasicMaterial,
  edgeCache: Map<THREE.BufferGeometry, THREE.EdgesGeometry>,
  threshold: number = BOARD.EDGE_THRESHOLD_TAK,
  options?: { hullOutline?: boolean; edgeLines?: boolean },
): THREE.Mesh {
  mesh.clear();
  if (options?.hullOutline !== false) {
    const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
    outlineMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed += normal * ${BOARD.OUTLINE_EXPAND};`,
      );
    };
    mesh.add(outline);
  }
  if (options?.edgeLines !== false) {
    let edges = edgeCache.get(mesh.geometry);
    if (!edges) {
      edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
      edgeCache.set(mesh.geometry, edges);
    }
    mesh.add(new THREE.LineSegments(edges, edgeMaterial));
  }
  return mesh;
}

/** World-units diameter of the contact decal from a piece footprint (XZ bounds). */
export function contactShadowScaleFromGeometry(geo: THREE.BufferGeometry | null | undefined): number {
  const fallback = BOARD.SHADOW_SCALE * 0.95;
  if (!geo) return fallback;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!box) return fallback;
  const footprint = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 0.01);
  // Wider pieces (e.g. Boop vases) need a footprint-based blob; small Tak stones keep the legacy minimum.
  return Math.max(fallback, footprint * BOARD.SHADOW_SCALE * 1.06);
}

export function syncPieceContactShadowScale(shadow: THREE.Mesh, geo: THREE.BufferGeometry): void {
  const scale = contactShadowScaleFromGeometry(geo);
  shadow.scale.set(scale, scale, 1);
}

const groundShadowBounds = new THREE.Box3();

/** Position a horizontal contact decal at the piece footprint (follows mesh during motion). */
export function syncPieceGroundShadowPosition(
  shadow: THREE.Object3D,
  mesh: THREE.Object3D,
  fallbackHalfHeight = 0,
): void {
  mesh.updateMatrixWorld(true);
  groundShadowBounds.setFromObject(mesh);
  if (Number.isFinite(groundShadowBounds.min.y)) {
    shadow.position.y = groundShadowBounds.min.y + BOARD.SHADOW_CONTACT_EPSILON;
  } else {
    shadow.position.y = mesh.position.y - fallbackHalfHeight + BOARD.SHADOW_CONTACT_EPSILON;
  }
  const center = groundShadowBounds.getCenter(new THREE.Vector3());
  shadow.position.x = center.x;
  shadow.position.z = center.z;
}

export function makePieceShadow(
  geo: THREE.BufferGeometry,
  group: THREE.Group,
): THREE.Mesh;
export function makePieceShadow(
  geo: THREE.BufferGeometry,
  material: THREE.MeshBasicMaterial,
  group: THREE.Group,
): THREE.Mesh;
export function makePieceShadow(
  geo: THREE.BufferGeometry,
  materialOrGroup: THREE.MeshBasicMaterial | THREE.Group,
  group?: THREE.Group,
): THREE.Mesh {
  const groupTarget = group ?? (materialOrGroup as THREE.Group);
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: pieceContactShadowTexture(),
      transparent: true,
      opacity: BOARD.PIECE_CONTACT_SHADOW_OPACITY,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  decal.rotation.x = -Math.PI / 2;
  syncPieceContactShadowScale(decal, geo);
  decal.renderOrder = 1;
  decal.castShadow = false;
  decal.receiveShadow = false;
  groupTarget.add(decal);
  return decal;
}
