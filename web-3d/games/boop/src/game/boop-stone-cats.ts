import {
  BOARD,
  CAMERA,
  clonePieceVisualTemplate,
  ensureMeshoptDecoderReady,
  createMeshoptGltfLoader,
  pieceGlbSideForPlayer,
  pieceUrl,
  prepareAuthoredPieceGlb,
  PIECE_OPAQUE_MATERIALS_READY_USER_DATA,
  PIECE_SKIP_CAST_SHADOW_USER_DATA,
  type EnginePiece,
  type PieceGeometrySet,
  type ThemeId,
} from '@abstract/three-engine';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { createGroundedBoopPieces } from './boop-grounding';
import { boopVaseGlbFor, type BoopVasePlayerId, type BoopVaseVariant } from './boop-vase-assets';

/** Large vase max X/Z on a 1-unit bed cell (~80% of tile × 1.2 boost ≈ 0.96). */
const LARGE_VASE_TILE_FOOTPRINT = 0.8 * 1.2;

/** Target triangle count for directional-shadow casters (full vase ≈ 17–20k). */
const SHADOW_STANDIN_TARGET_TRIS = 2000;

const BOOP_SHADOW_CASTER_NAME = '__boopShadowCaster';
const BOOP_CONTACT_SHADOW_NAME = '__boopContactShadow';
export const BOOP_CONTACT_SHADOW_USER_DATA = 'boopContactShadow';

const contactShadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
  toneMapped: false,
});

/** Face +X-authored models toward the default camera in XZ. */
export const BOOP_STONE_CAT_YAW =
  Math.atan2(CAMERA.position[0], CAMERA.position[2]) - Math.PI / 2;

function vaseAssetUrl(file: string): string {
  return pieceUrl(file);
}

export type StoneCatVariant = BoopVaseVariant;

/** Full GLB hierarchy for display (PBR materials intact); low-poly geo shared for shadow cast + engine hooks. */
interface StoneTemplate {
  visual: THREE.Object3D;
  shadowGeometry: THREE.BufferGeometry;
  height: number;
}

const _box = new THREE.Box3();
let loaderReady: Promise<void> | undefined;

const shadowCasterMaterial = new THREE.MeshStandardMaterial({
  colorWrite: false,
  depthWrite: false,
});

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

function triangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.index;
  if (index) return Math.floor(index.count / 3);
  const position = geometry.getAttribute('position');
  return position ? Math.floor(position.count / 3) : 0;
}

/** World-space merge of visible meshes (before decimation). */
function mergeWorldPieceGeometry(root: THREE.Object3D): THREE.BufferGeometry {
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

function simplifyForShadowStandIn(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const fullTris = triangleCount(geometry);
  if (fullTris <= SHADOW_STANDIN_TARGET_TRIS) return geometry;

  const positionCount = geometry.getAttribute('position').count;
  const removeCount = Math.max(
    1,
    Math.floor(positionCount * (1 - SHADOW_STANDIN_TARGET_TRIS / fullTris)),
  );
  const modifier = new SimplifyModifier();
  const simplified = modifier.modify(geometry, removeCount);
  simplified.computeVertexNormals();
  return simplified;
}

function contactShadowOpacity(theme: ThemeId): number {
  return theme === 'dark' ? 0.38 : 0.26;
}

/** Vase base radius in the visual's local space (CircleGeometry is not re-scaled by parent). */
export function baseFootprintRadiusLocal(visual: THREE.Object3D): number {
  const scale = visual.scale.x || 1;
  visual.updateMatrixWorld(true);
  _box.setFromObject(visual);
  const size = new THREE.Vector3();
  _box.getSize(size);
  return (Math.max(size.x, size.z) * 0.34) / scale;
}

/** Soft AO blob at the vase base (does not replace directional drop shadows). */
export function attachContactShadow(visual: THREE.Object3D, radiusLocal: number, theme: ThemeId): void {
  const existing = visual.getObjectByName(BOOP_CONTACT_SHADOW_NAME);
  if (existing) existing.parent?.remove(existing);

  const mat = contactShadowMaterial.clone();
  mat.opacity = contactShadowOpacity(theme);
  const disk = new THREE.Mesh(new THREE.CircleGeometry(radiusLocal, 28), mat);
  disk.name = BOOP_CONTACT_SHADOW_NAME;
  disk.rotation.x = -Math.PI / 2;
  const scale = visual.scale.x || 1;
  disk.position.y = 0.003 / scale;
  disk.renderOrder = 2;
  disk.castShadow = false;
  disk.receiveShadow = false;
  disk.userData.excludeFromPicking = true;
  disk.userData[BOOP_CONTACT_SHADOW_USER_DATA] = true;
  visual.add(disk);
}

export function attachShadowStandIn(visual: THREE.Object3D, shadowGeometry: THREE.BufferGeometry): void {
  visual.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node.name === BOOP_SHADOW_CASTER_NAME) return;
    node.userData[PIECE_SKIP_CAST_SHADOW_USER_DATA] = true;
    node.castShadow = false;
  });

  const shadowMesh = new THREE.Mesh(shadowGeometry, shadowCasterMaterial);
  shadowMesh.name = BOOP_SHADOW_CASTER_NAME;
  shadowMesh.castShadow = true;
  shadowMesh.receiveShadow = false;
  // Geometry is already in normalized world units. Cancel the visual's scale
  // and anchoring so it is not transformed a second time under this parent.
  visual.updateMatrixWorld(true);
  shadowMesh.applyMatrix4(visual.matrixWorld.clone().invert());
  shadowMesh.userData.excludeFromPicking = true;
  visual.add(shadowMesh);
}

function xzExtent(root: THREE.Object3D): number {
  _box.setFromObject(root);
  const size = new THREE.Vector3();
  _box.getSize(size);
  return Math.max(size.x, size.z);
}

function prepareVisualTemplate(scene: THREE.Group, worldScale: number, offlineShadow?: THREE.BufferGeometry): StoneTemplate {
  const visual = clonePieceVisualTemplate(scene);
  visual.scale.setScalar(worldScale);
  visual.updateMatrixWorld(true);
  uprightIfNeeded(visual);
  anchorObjectBaseToFloor(visual);
  const height = measureHeight(visual);

  const shadowGeometry = offlineShadow
    ? offlineShadow.clone().scale(worldScale, worldScale, worldScale)
    : simplifyForShadowStandIn(mergeWorldPieceGeometry(visual.clone(true)));
  attachShadowStandIn(visual, shadowGeometry);
  attachContactShadow(visual, baseFootprintRadiusLocal(visual), boopPieceTheme);

  visual.userData[PIECE_OPAQUE_MATERIALS_READY_USER_DATA] = true;
  return { visual, shadowGeometry, height };
}

const BOOP_VASE_FILES = [
  'boop-vase-large-white.glb',
  'boop-vase-large-black.glb',
  'boop-vase-small-white.glb',
  'boop-vase-small-black.glb',
] as const;

export async function loadBoopShadowGeometry(url: string): Promise<THREE.BufferGeometry> {
  return mergeWorldPieceGeometry(await loadGltfScene(url));
}

type BoopVaseFile = (typeof BOOP_VASE_FILES)[number];

async function loadTemplates(offlineShadows?: Record<StoneCatVariant, THREE.BufferGeometry>): Promise<Record<BoopVasePlayerId, Record<StoneCatVariant, StoneTemplate>>> {
  const scenes = await Promise.all(
    BOOP_VASE_FILES.map(file => loadGltfScene(vaseAssetUrl(file))),
  );
  const sceneByFile = Object.fromEntries(
    BOOP_VASE_FILES.map((file, index) => [file, scenes[index]!]),
  ) as Record<BoopVaseFile, THREE.Group>;

  const scale = LARGE_VASE_TILE_FOOTPRINT / xzExtent(sceneByFile['boop-vase-large-white.glb']);

  const templateByFile = new Map<BoopVaseFile, StoneTemplate>();
  for (const file of BOOP_VASE_FILES) {
    const scene = sceneByFile[file];
    prepareAuthoredPieceGlb(scene);
    const variant = file.includes('large') ? 'cat' : 'kitten';
    templateByFile.set(file, prepareVisualTemplate(scene, scale, offlineShadows?.[variant]));
  }

  const players = ['A', 'B'] as const;
  const out = {} as Record<BoopVasePlayerId, Record<StoneCatVariant, StoneTemplate>>;
  for (const player of players) {
    out[player] = {
      cat: templateByFile.get(boopVaseGlbFor(player, 'cat') as BoopVaseFile)!,
      kitten: templateByFile.get(boopVaseGlbFor(player, 'kitten') as BoopVaseFile)!,
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

function syncContactShadowOnRoot(root: THREE.Object3D) {
  const disk = root.getObjectByName(BOOP_CONTACT_SHADOW_NAME) as THREE.Mesh | undefined;
  if (disk?.material instanceof THREE.MeshBasicMaterial) {
    disk.material.opacity = contactShadowOpacity(boopPieceTheme);
  }
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
      syncContactShadowOnRoot(root);
      return root;
    },
    replaceVisual(root: THREE.Object3D, piece: EnginePiece) {
      mountModel(root as THREE.Group, clonePieceVisualTemplate(templateFor(piece).visual));
      syncContactShadowOnRoot(root);
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
  offlineShadows?: Record<StoneCatVariant, THREE.BufferGeometry>,
): Promise<PieceGeometrySet> {
  try {
    const templates = await loadTemplates(offlineShadows);
    return createStonePieceSet(templates);
  } catch (err) {
    console.warn('[boop] stone vase GLB load failed, using procedural pieces', err);
    return createGroundedBoopPieces(fallbackCat, fallbackKitten);
  }
}
