import {
  BOARD,
  CAMERA,
  clonePieceVisualTemplate,
  ensureMeshoptDecoderReady,
  createMeshoptGltfLoader,
  pieceGlbSideForPlayer,
  pieceUrl,
  prepareAuthoredPieceGlb,
  type EnginePiece,
  type PieceGeometrySet,
  type ThemeId,
} from '@abstract/three-engine';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createGroundedBoopPieces } from './boop-grounding';
import { boopVaseGlbFor, type BoopVasePlayerId, type BoopVaseVariant } from './boop-vase-assets';

/** Large vase max X/Z on a 1-unit bed cell (~80% of tile × 1.2 boost ≈ 0.96). */
const LARGE_VASE_TILE_FOOTPRINT = 0.8 * 1.2;

/** Face +X-authored models toward the default camera in XZ. */
export const BOOP_STONE_CAT_YAW =
  Math.atan2(CAMERA.position[0], CAMERA.position[2]) - Math.PI / 2;

function vaseAssetUrl(file: string): string {
  return pieceUrl(file);
}

export type StoneCatVariant = BoopVaseVariant;

/** Full GLB hierarchy for display (PBR materials intact); baked geo for contact shadows only. */
interface StoneTemplate {
  visual: THREE.Object3D;
  shadowGeometry: THREE.BufferGeometry;
  height: number;
}

const _box = new THREE.Box3();
let loaderReady: Promise<void> | undefined;

async function getLoader() {
  if (!loaderReady) loaderReady = ensureMeshoptDecoderReady();
  await loaderReady;
  return createMeshoptGltfLoader();
}

function loadGltfScene(url: string): Promise<THREE.Group> {
  return getLoader().then(loader =>
    new Promise((resolve, reject) => {
      loader.load(url, gltf => resolve(gltf.scene), undefined, reject);
    }),
  );
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse(node => {
    if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh);
  });
  return meshes;
}

function uprightIfNeeded(object: THREE.Object3D): void {
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  const size = new THREE.Vector3();
  _box.getSize(size);
  if (size.y <= Math.min(size.x, size.z) * 0.85) {
    object.rotation.x = -Math.PI / 2;
    object.updateMatrixWorld(true);
  }
}

/** Floor at y=0, centre on XZ (authored base-centre). */
function anchorObjectBaseToFloor(object: THREE.Object3D): void {
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  if (!Number.isFinite(_box.min.y)) return;
  const cx = (_box.min.x + _box.max.x) / 2;
  const cz = (_box.min.z + _box.max.z) / 2;
  object.position.x -= cx;
  object.position.z -= cz;
  object.position.y -= _box.min.y;
  object.updateMatrixWorld(true);
}

function measureHeight(object: THREE.Object3D): number {
  _box.setFromObject(object);
  return _box.max.y - _box.min.y;
}

/** World-space merge for shadow meshes only (not used for the visible piece). */
function bakeShadowGeometry(root: THREE.Object3D): THREE.BufferGeometry {
  root.updateMatrixWorld(true);
  const meshes = collectMeshes(root);
  if (!meshes.length) throw new Error('No mesh in gltf scene');

  const parts = meshes.map(mesh => {
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    return g;
  });
  let geometry = parts.length === 1 ? parts[0]! : mergeGeometries(parts, false);
  if (!geometry) throw new Error('Failed to merge gltf meshes');

  geometry.computeBoundingBox();
  let box = geometry.boundingBox!;
  let size = new THREE.Vector3();
  box.getSize(size);

  if (size.y <= Math.min(size.x, size.z) * 0.85) {
    geometry.rotateX(-Math.PI / 2);
    geometry.computeBoundingBox();
    box = geometry.boundingBox!;
    box.getSize(size);
  }

  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  geometry.translate(-cx, -box.min.y, -cz);
  geometry.computeVertexNormals();
  return geometry;
}

function xzExtent(root: THREE.Object3D): number {
  _box.setFromObject(root);
  const size = new THREE.Vector3();
  _box.getSize(size);
  return Math.max(size.x, size.z);
}

function prepareVisualTemplate(scene: THREE.Group, worldScale: number): StoneTemplate {
  const visual = clonePieceVisualTemplate(scene);
  visual.scale.setScalar(worldScale);
  visual.updateMatrixWorld(true);
  uprightIfNeeded(visual);
  anchorObjectBaseToFloor(visual);
  const height = measureHeight(visual);
  const shadowGeometry = bakeShadowGeometry(visual.clone(true));
  return { visual, shadowGeometry, height };
}

async function loadVariantTemplate(
  player: BoopVasePlayerId,
  variant: StoneCatVariant,
  scale: number,
): Promise<StoneTemplate> {
  const file = boopVaseGlbFor(player, variant);
  const scene = await loadGltfScene(vaseAssetUrl(file));
  prepareAuthoredPieceGlb(scene);
  return prepareVisualTemplate(scene, scale);
}

async function loadTemplates(): Promise<Record<BoopVasePlayerId, Record<StoneCatVariant, StoneTemplate>>> {
  const largeScene = await loadGltfScene(vaseAssetUrl('boop-vase-large-white.glb'));
  const scale = LARGE_VASE_TILE_FOOTPRINT / xzExtent(largeScene);

  const players = ['A', 'B'] as const;
  const out = {} as Record<BoopVasePlayerId, Record<StoneCatVariant, StoneTemplate>>;

  for (const player of players) {
    out[player] = {
      cat: await loadVariantTemplate(player, 'cat', scale),
      kitten: await loadVariantTemplate(player, 'kitten', scale),
    };
  }
  return out;
}

let boopPieceTheme: ThemeId = 'light';

function resolveTemplate(
  templates: Record<BoopVasePlayerId, Record<StoneCatVariant, StoneTemplate>>,
  piece: EnginePiece,
): StoneTemplate {
  const player: BoopVasePlayerId = pieceGlbSideForPlayer(boopPieceTheme, piece.player);
  const variant: StoneCatVariant = piece.shape === 'kitten' ? 'kitten' : 'cat';
  return templates[player][variant];
}

function mountModel(root: THREE.Group, model: THREE.Object3D) {
  root.clear();
  root.add(model);
  root.rotation.y = BOOP_STONE_CAT_YAW;
}

function createStonePieceSet(
  templates: Record<BoopVasePlayerId, Record<StoneCatVariant, StoneTemplate>>,
): PieceGeometrySet {
  const geometryFor = (piece: EnginePiece) => resolveTemplate(templates, piece).shadowGeometry;
  const heightFor = (piece: EnginePiece) => resolveTemplate(templates, piece).height;
  const templateFor = (piece: EnginePiece) => resolveTemplate(templates, piece);

  return {
    geometry: geometryFor,
    height: heightFor,
    geometryOrigin: 'base' as const,
    yaw: () => BOOP_STONE_CAT_YAW,
    edgeThreshold: BOARD.EDGE_THRESHOLD_BOOP,
    useOutline: () => false,
    materialFor: () => null,
    createVisual(piece: EnginePiece) {
      const root = new THREE.Group();
      mountModel(root, clonePieceVisualTemplate(templateFor(piece).visual));
      return root;
    },
    replaceVisual(root: THREE.Object3D, piece: EnginePiece) {
      mountModel(root as THREE.Group, clonePieceVisualTemplate(templateFor(piece).visual));
    },
    onThemeChange(id) {
      boopPieceTheme = id;
    },
  };
}

/** Load Alex stone vase GLBs; fall back to procedural pieces if loading fails. */
export async function createBoopPieceGeometrySet(
  fallbackCat: THREE.BufferGeometry,
  fallbackKitten: THREE.BufferGeometry,
): Promise<PieceGeometrySet> {
  try {
    const templates = await loadTemplates();
    return createStonePieceSet(templates);
  } catch (err) {
    console.warn('[boop] stone vase GLB load failed, using procedural pieces', err);
    return createGroundedBoopPieces(fallbackCat, fallbackKitten);
  }
}
