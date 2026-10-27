import {
  BOARD,
  CAMERA,
  clonePieceVisualTemplate,
  ensureMeshoptDecoderReady,
  createMeshoptGltfLoader,
  pieceUrl,
  cloneMeshMaterials,
  ensureOpaquePieceMaterials,
  PIECE_SKIP_CAST_SHADOW_USER_DATA,
  tagExcludeFromBounds,
  PIECE_OPAQUE_MATERIALS_READY_USER_DATA,
  type EnginePiece,
  type PieceGeometrySet,
} from '@abstract/three-engine';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { createGroundedBoopPieces } from './boop-grounding';
import { boopVaseGlbFor, type BoopVasePlayerId, type BoopVaseVariant } from './boop-vase-assets';

/** Large vase max X/Z on a 1-unit bed cell (~80% of tile × 1.2 boost ≈ 0.96). */
const LARGE_VASE_TILE_FOOTPRINT = 0.8 * 1.2;

/** Fallback caster budget; default prerender mode uses the offline 1k proxies. */
const SHADOW_STANDIN_TARGET_TRIS = 2000;

/** Face +X-authored models toward the default camera in XZ. */
export const BOOP_STONE_CAT_YAW =
  Math.atan2(CAMERA.position[0], CAMERA.position[2]) - Math.PI / 2;

function vaseAssetUrl(file: string): string {
  return pieceUrl(file);
}

export type StoneCatVariant = BoopVaseVariant;

/** Baked visual hierarchy and a separate low-poly caster shared with picking/layout. */
interface StoneTemplate {
  visual: THREE.Object3D;
  shadowGeometry: THREE.BufferGeometry;
  height: number;
}

const _box = new THREE.Box3();
let loaderReady: Promise<void> | undefined;

const BOOP_CONTACT_HALO_NAME = 'boop-contact-halo';
let contactHaloMap: THREE.CanvasTexture | null = null;

function contactHaloMaterial(): THREE.MeshBasicMaterial {
  if (!contactHaloMap) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
      g.addColorStop(0, 'rgba(12, 10, 8, 0.5)');
      g.addColorStop(0.42, 'rgba(12, 10, 8, 0.26)');
      g.addColorStop(0.72, 'rgba(12, 10, 8, 0.08)');
      g.addColorStop(1, 'rgba(12, 10, 8, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    contactHaloMap = new THREE.CanvasTexture(canvas);
    contactHaloMap.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshBasicMaterial({
    map: contactHaloMap,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
}

/** Ground disc at the vase base. Depth test keeps it off the body. */
function attachContactHalo(visual: THREE.Object3D): void {
  visual.updateMatrixWorld(true);
  const scale = Math.abs(visual.scale.x) || 1;
  const radius = (xzExtent(visual) * 0.78) / scale;
  const geometry = new THREE.CircleGeometry(Math.max(radius, 0.05), 40);
  geometry.rotateX(-Math.PI / 2);
  const halo = new THREE.Mesh(geometry, contactHaloMaterial());
  halo.name = BOOP_CONTACT_HALO_NAME;
  halo.position.y = 0.006 / scale;
  halo.renderOrder = 2;
  halo.castShadow = false;
  halo.receiveShadow = false;
  halo.userData.excludeFromPicking = true;
  halo.userData[PIECE_SKIP_CAST_SHADOW_USER_DATA] = true;
  visual.add(halo);
}

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

/** Isolate material state while retaining authored albedo, normal and PBR settings. */
export function prepareDetailedVaseGlb(root: THREE.Object3D): void {
  cloneMeshMaterials(root);
  ensureOpaquePieceMaterials(root);
  root.traverse(node => {
    if (node instanceof THREE.Mesh && !node.geometry.getAttribute('normal')) {
      node.geometry.computeVertexNormals();
    }
  });
}
/**
 * Both inputs are already upright, base-centred and scaled to board units.
 * Keep the caster beside the authored transform rather than scaling it twice.
 */
export function enableVaseShadows(
  visual: THREE.Object3D,
  shadowGeometry: THREE.BufferGeometry,
): THREE.Group {
  visual.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.userData[PIECE_SKIP_CAST_SHADOW_USER_DATA] = true;
    node.castShadow = false;
    // VSM also includes receivers in its shadow pass.
    node.receiveShadow = false;
  });
  const caster = new THREE.Mesh(shadowGeometry, new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  caster.name = 'boop-vase-shadow-proxy';
  caster.castShadow = true;
  caster.receiveShadow = false;
  caster.userData.excludeFromPicking = true;
  tagExcludeFromBounds(caster);
  const root = new THREE.Group();
  root.add(visual, caster);
  root.userData[PIECE_OPAQUE_MATERIALS_READY_USER_DATA] = true;
  return root;
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
  attachContactHalo(visual);
  const display = enableVaseShadows(visual, shadowGeometry);

  display.userData[PIECE_OPAQUE_MATERIALS_READY_USER_DATA] = true;
  return { visual: display, shadowGeometry, height };
}

const BOOP_VASE_FILES = [
  'boop-vase-large-white-detail.glb',
  'boop-vase-large-black-detail.glb',
  'boop-vase-small-white-detail.glb',
  'boop-vase-small-black-detail.glb',
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

  const scale = LARGE_VASE_TILE_FOOTPRINT / xzExtent(sceneByFile['boop-vase-large-white-detail.glb']);

  const templateByFile = new Map<BoopVaseFile, StoneTemplate>();
  for (const file of BOOP_VASE_FILES) {
    const scene = sceneByFile[file];
    prepareDetailedVaseGlb(scene);
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

function resolveTemplate(
  templates: Record<BoopVasePlayerId, Record<StoneCatVariant, StoneTemplate>>,
  piece: EnginePiece,
): StoneTemplate {
  const player: BoopVasePlayerId = piece.player === 'B' ? 'B' : 'A';
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
