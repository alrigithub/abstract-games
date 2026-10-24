import {
  BOARD,
  CAMERA,
  type EnginePiece,
  type PieceGeometrySet,
  type ThemeTokens,
} from '@abstract/three-engine';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createGroundedBoopPieces } from './boop-grounding';

/** Adult cat max X/Z on a 1-unit bed cell (~80% of tile), then global piece boost. */
const ADULT_TILE_FOOTPRINT = 0.8 * 1.2;

/** Face +X-authored models toward the default camera in XZ. */
export const BOOP_STONE_CAT_YAW =
  Math.atan2(CAMERA.position[0], CAMERA.position[2]) - Math.PI / 2;

function assetUrl(folder: 'cats' | 'vases', file: string): string {
  return new URL(`assets/${folder}/${file}`, document.baseURI).toString();
}

const CAT_FILES = {
  A: 'cat-adult-granite.glb',
  B: 'cat-adult-slate.glb',
} as const;

/** Kitten pool uses stone vases (granite/slate) from `public/assets/vases/`. */
function vaseFileCandidates(player: PlayerId): string[] {
  const stone = player === 'A' ? 'granite' : 'slate';
  return [
    `vase-junior-${stone}.glb`,
    `vase-${stone}.glb`,
    `junior-${stone}-vase.glb`,
  ];
}

const JUNIOR_CAT_FALLBACK = {
  A: 'cat-junior-granite.glb',
  B: 'cat-junior-slate.glb',
} as const;

export type StoneCatVariant = 'cat' | 'kitten';

interface StoneTemplate {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  height: number;
}

const loader = new GLTFLoader();

function loadGltfScene(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(url, gltf => resolve(gltf.scene), undefined, reject);
  });
}

async function loadFirstGltf(folder: 'cats' | 'vases', names: readonly string[]): Promise<THREE.Group> {
  let lastError: unknown;
  for (const name of names) {
    try {
      return await loadGltfScene(assetUrl(folder, name));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error(`No GLB found in assets/${folder}/ for ${names.join(', ')}`);
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse(node => {
    if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh);
  });
  return meshes;
}

/**
 * Bake full node hierarchy (scale + transforms) into one geometry; Y-up, floor at y=0.
 * If the authored mesh is lying (thinnest axis is Y), rotate upright before anchoring.
 */
function bakeSceneToFloorGeometry(root: THREE.Object3D): StoneTemplate {
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
  geometry.computeBoundingBox();
  const height = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;

  const sourceMat = meshes[0]!.material;
  const material = (Array.isArray(sourceMat) ? sourceMat[0] : sourceMat).clone() as THREE.MeshStandardMaterial;
  material.side = THREE.FrontSide;

  return { geometry, material, height };
}

function xzExtent(root: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(size.x, size.z);
}

function prepareFromScene(scene: THREE.Group, worldScale: number): StoneTemplate {
  const clone = scene.clone(true);
  clone.scale.setScalar(worldScale);
  clone.updateMatrixWorld(true);
  return bakeSceneToFloorGeometry(clone);
}

async function loadKittenTemplate(player: PlayerId, scale: number): Promise<StoneTemplate> {
  try {
    const scene = await loadFirstGltf('vases', vaseFileCandidates(player));
    return prepareFromScene(scene, scale);
  } catch (err) {
    console.warn(
      `[boop] stone vase GLB missing for player ${player} (expected in public/assets/vases/). ` +
        `Tried: ${vaseFileCandidates(player).join(', ')}. Using cat-junior fallback.`,
      err,
    );
    const scene = await loadGltfScene(assetUrl('cats', JUNIOR_CAT_FALLBACK[player]));
    return prepareFromScene(scene, scale);
  }
}

async function loadTemplates(): Promise<Record<PlayerId, Record<StoneCatVariant, StoneTemplate>>> {
  const adultScene = await loadGltfScene(assetUrl('cats', CAT_FILES.A));
  const scale = ADULT_TILE_FOOTPRINT / xzExtent(adultScene);

  const players = ['A', 'B'] as const;
  const out = {} as Record<PlayerId, Record<StoneCatVariant, StoneTemplate>>;

  for (const player of players) {
    const catScene = await loadGltfScene(assetUrl('cats', CAT_FILES[player]));
    out[player] = {
      cat: prepareFromScene(catScene, scale),
      kitten: await loadKittenTemplate(player, scale),
    };
  }
  return out;
}

type PlayerId = 'A' | 'B';

function materialForTemplate(
  template: StoneTemplate,
  selected: boolean | undefined,
): THREE.Material {
  const mat = template.material.clone();
  if (selected && 'emissive' in mat) {
    const m = mat as THREE.MeshStandardMaterial;
    m.emissive = m.emissive?.clone() ?? new THREE.Color(0x333333);
    m.emissiveIntensity = (m.emissiveIntensity ?? 0) + 0.35;
  }
  return mat;
}

function resolveTemplate(
  templates: Record<PlayerId, Record<StoneCatVariant, StoneTemplate>>,
  piece: EnginePiece,
): StoneTemplate {
  const player: PlayerId = piece.player === 'B' ? 'B' : 'A';
  const variant: StoneCatVariant = piece.shape === 'kitten' ? 'kitten' : 'cat';
  return templates[player][variant];
}

function createStonePieceSet(templates: Record<PlayerId, Record<StoneCatVariant, StoneTemplate>>): PieceGeometrySet {
  const geometryFor = (piece: EnginePiece) => resolveTemplate(templates, piece).geometry;
  const heightFor = (piece: EnginePiece) => resolveTemplate(templates, piece).height;
  const templateFor = (piece: EnginePiece) => resolveTemplate(templates, piece);

  return {
    geometry: geometryFor,
    height: heightFor,
    verticalOffset(piece) {
      return -heightFor(piece) / 2;
    },
    yaw: () => BOOP_STONE_CAT_YAW,
    edgeThreshold: BOARD.EDGE_THRESHOLD_BOOP,
    useOutline: () => false,
    materialFor(piece: EnginePiece, _tokens: ThemeTokens, selected?: boolean) {
      void _tokens;
      return materialForTemplate(templateFor(piece), selected);
    },
  };
}

/** Load Alex stone GLBs (cats + vases for kittens); fall back to procedural pieces if loading fails. */
export async function createBoopPieceGeometrySet(
  fallbackCat: THREE.BufferGeometry,
  fallbackKitten: THREE.BufferGeometry,
): Promise<PieceGeometrySet> {
  try {
    const templates = await loadTemplates();
    return createStonePieceSet(templates);
  } catch (err) {
    console.warn('[boop] stone GLB load failed, using procedural pieces', err);
    return createGroundedBoopPieces(fallbackCat, fallbackKitten);
  }
}
