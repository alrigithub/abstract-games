import {
  BOARD,
  CAMERA,
  type EnginePiece,
  type PieceGeometrySet,
  type ThemeTokens,
} from '@abstract/three-engine';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createGroundedBoopPieces } from './boop-grounding';

/** Max X/Z extent of an adult cat after scaling (6×6 bed cell spacing is 1 world unit). */
const ADULT_CELL_FIT = 0.72;

function glbUrl(file: string): string {
  return new URL(`assets/cats/${file}`, document.baseURI).toString();
}

const GLB_FILES = {
  A: { cat: 'cat-adult-granite.glb', kitten: 'cat-junior-granite.glb' },
  B: { cat: 'cat-adult-slate.glb', kitten: 'cat-junior-slate.glb' },
} as const;

export type StoneCatVariant = keyof typeof GLB_FILES.A;

interface StoneTemplate {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  height: number;
}

/** Y rotation so model fronts face the default orthographic camera. */
export const BOOP_STONE_CAT_YAW =
  Math.atan2(CAMERA.position[0], CAMERA.position[2]) + Math.PI;

const loader = new GLTFLoader();

function loadGltfScene(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(url, gltf => resolve(gltf.scene), undefined, reject);
  });
}

function firstMesh(root: THREE.Object3D): THREE.Mesh {
  let found: THREE.Mesh | null = null;
  root.traverse(node => {
    if (found) return;
    if ((node as THREE.Mesh).isMesh) found = node as THREE.Mesh;
  });
  if (!found) throw new Error(`No mesh in ${root.name || 'gltf'}`);
  return found;
}

/** Bake world transform into geometry; center on origin for center-based stack layout (no verticalOffset). */
function bakeMeshToCenteredGeometry(mesh: THREE.Mesh, _worldScale: number): StoneTemplate {
  void _worldScale;
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  geometry.translate(-cx, -cy, -cz);
  geometry.computeBoundingBox();
  const height = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone();
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
  return bakeMeshToCenteredGeometry(firstMesh(clone), worldScale);
}

async function loadTemplates(): Promise<Record<PlayerId, Record<StoneCatVariant, StoneTemplate>>> {
  const adultScene = await loadGltfScene(glbUrl(GLB_FILES.A.cat));
  const scale = ADULT_CELL_FIT / xzExtent(adultScene);

  const players = ['A', 'B'] as const;
  const out = {} as Record<PlayerId, Record<StoneCatVariant, StoneTemplate>>;

  for (const player of players) {
    out[player] = {} as Record<StoneCatVariant, StoneTemplate>;
    for (const variant of ['cat', 'kitten'] as const) {
      const scene = await loadGltfScene(glbUrl(GLB_FILES[player][variant]));
      out[player][variant] = prepareFromScene(scene, scale);
    }
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
    yaw: () => BOOP_STONE_CAT_YAW,
    edgeThreshold: BOARD.EDGE_THRESHOLD_BOOP,
    useOutline: () => false,
    materialFor(piece: EnginePiece, _tokens: ThemeTokens, selected?: boolean) {
      void _tokens;
      return materialForTemplate(templateFor(piece), selected);
    },
  };
}

/** Load Alex stone-cat GLBs; fall back to procedural lathe/cylinder pieces if loading fails. */
export async function createBoopPieceGeometrySet(
  fallbackCat: THREE.BufferGeometry,
  fallbackKitten: THREE.BufferGeometry,
): Promise<PieceGeometrySet> {
  try {
    const templates = await loadTemplates();
    return createStonePieceSet(templates);
  } catch (err) {
    console.warn('[boop] stone cat GLB load failed, using procedural pieces', err);
    return createGroundedBoopPieces(fallbackCat, fallbackKitten);
  }
}
