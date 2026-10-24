import {
  BOARD,
  CAMERA,
  type EnginePiece,
  type PieceGeometrySet,
} from '@abstract/three-engine';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createGroundedBoopPieces } from './boop-grounding';

/** Large vase max X/Z on a 1-unit bed cell (~80% of tile × 1.2 boost ≈ 0.96). */
const LARGE_VASE_TILE_FOOTPRINT = 0.8 * 1.2;

/** Face +X-authored models toward the default camera in XZ. */
export const BOOP_STONE_CAT_YAW =
  Math.atan2(CAMERA.position[0], CAMERA.position[2]) - Math.PI / 2;

function vaseAssetUrl(file: string): string {
  return new URL(`assets/vases/${file}`, document.baseURI).toString();
}

function catFileCandidates(player: PlayerId): string[] {
  return [player === 'A' ? 'vase-large-white.glb' : 'vase-large-black.glb'];
}

function kittenFileCandidates(player: PlayerId): string[] {
  const primary = player === 'A' ? 'vase-small-white.glb' : 'vase-small-black.glb';
  const stone = player === 'A' ? 'granite' : 'slate';
  return [
    primary,
    `vase-junior-${stone}.glb`,
    `vase-${stone}.glb`,
    `junior-${stone}-vase.glb`,
  ];
}

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

async function loadFirstGltf(names: readonly string[]): Promise<THREE.Group> {
  let lastError: unknown;
  for (const name of names) {
    try {
      return await loadGltfScene(vaseAssetUrl(name));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error(`No vase GLB found for ${names.join(', ')}`);
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
  const material = (Array.isArray(sourceMat) ? sourceMat[0] : sourceMat).clone();

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

async function loadVariantTemplate(
  player: PlayerId,
  variant: StoneCatVariant,
  scale: number,
): Promise<StoneTemplate> {
  const names = variant === 'kitten' ? kittenFileCandidates(player) : catFileCandidates(player);
  const scene = await loadFirstGltf(names);
  return prepareFromScene(scene, scale);
}

async function loadTemplates(): Promise<Record<PlayerId, Record<StoneCatVariant, StoneTemplate>>> {
  const largeScene = await loadGltfScene(vaseAssetUrl('vase-large-white.glb'));
  const scale = LARGE_VASE_TILE_FOOTPRINT / xzExtent(largeScene);

  const players = ['A', 'B'] as const;
  const out = {} as Record<PlayerId, Record<StoneCatVariant, StoneTemplate>>;

  for (const player of players) {
    out[player] = {
      cat: await loadVariantTemplate(player, 'cat', scale),
      kitten: await loadVariantTemplate(player, 'kitten', scale),
    };
  }
  return out;
}

type PlayerId = 'A' | 'B';

function resolveTemplate(
  templates: Record<PlayerId, Record<StoneCatVariant, StoneTemplate>>,
  piece: EnginePiece,
): StoneTemplate {
  const player: PlayerId = piece.player === 'B' ? 'B' : 'A';
  const variant: StoneCatVariant = piece.shape === 'kitten' ? 'kitten' : 'cat';
  return templates[player][variant];
}

function mountVisual(root: THREE.Group, template: StoneTemplate) {
  root.clear();
  const mesh = new THREE.Mesh(template.geometry, template.material.clone());
  root.add(mesh);
  root.rotation.y = BOOP_STONE_CAT_YAW;
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
    materialFor: () => null,
    createVisual(piece: EnginePiece) {
      const root = new THREE.Group();
      mountVisual(root, templateFor(piece));
      return root;
    },
    replaceVisual(root: THREE.Object3D, piece: EnginePiece) {
      mountVisual(root as THREE.Group, templateFor(piece));
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
