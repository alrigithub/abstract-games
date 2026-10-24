import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  BOARD,
  createTakPieceGeometries,
  geometryBoundingBoxHeight,
  heightFromBoundingBox,
  takPieceGeometrySet,
  type EnginePiece,
  clonePieceVisualTemplate,
  pieceGlbSideForPlayer,
  type PieceGeometrySet,
  type ThemeId,
} from '@abstract/three-engine';

/** Prior procedural flat width in world units (one cell ≈ 1). */
export const TAK_FLAT_TARGET_WIDTH = 0.68;

/** Alex GLB flat footprint in meters (README). */
export const TAK_GLB_FLAT_WIDTH_M = 0.028;

/** Single scale applied to every Tak GLB (meters → world units). */
export const TAK_GLB_WORLD_SCALE = TAK_FLAT_TARGET_WIDTH / TAK_GLB_FLAT_WIDTH_M;

const MODEL = {
  flatWhite: 'models/tak-flat-white.glb',
  flatBlack: 'models/tak-flat-black.glb',
  uprightWhite: 'models/tak-upright-white.glb',
  uprightBlack: 'models/tak-upright-black.glb',
  capWhite: 'models/tak-capstone-white.glb',
  capBlack: 'models/tak-capstone-black.glb',
} as const;

type ShapeKey = 'flat' | 'standing' | 'capstone';

interface TakTemplates {
  flat: { A: THREE.Object3D; B: THREE.Object3D };
  standing: { A: THREE.Object3D; B: THREE.Object3D };
  capstone: { A: THREE.Object3D; B: THREE.Object3D };
  heights: Record<ShapeKey, number>;
}

const _box = new THREE.Box3();

function modelUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const origin = globalThis.location?.href ?? 'http://127.0.0.1/';
  return new URL(`${prefix}${path}`, origin).href;
}

function anchorObjectBaseToY0(object: THREE.Object3D): void {
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  if (Number.isFinite(_box.min.y)) object.position.y -= _box.min.y;
  object.updateMatrixWorld(true);
}

function prepareTemplate(scene: THREE.Object3D): THREE.Object3D {
  const root = clonePieceVisualTemplate(scene);
  root.scale.setScalar(TAK_GLB_WORLD_SCALE);
  root.updateMatrixWorld(true);
  anchorObjectBaseToY0(root);
  return root;
}

function measureHeight(template: THREE.Object3D): number {
  _box.setFromObject(template);
  return heightFromBoundingBox(_box);
}

async function loadScene(url: string): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

async function buildTemplates(): Promise<TakTemplates> {
  const [flatWhite, flatBlack, uprightWhite, uprightBlack, capWhite, capBlack] = await Promise.all([
    loadScene(modelUrl(MODEL.flatWhite)),
    loadScene(modelUrl(MODEL.flatBlack)),
    loadScene(modelUrl(MODEL.uprightWhite)),
    loadScene(modelUrl(MODEL.uprightBlack)),
    loadScene(modelUrl(MODEL.capWhite)),
    loadScene(modelUrl(MODEL.capBlack)),
  ]);
  const flat = { A: prepareTemplate(flatWhite), B: prepareTemplate(flatBlack) };
  const capstone = { A: prepareTemplate(capWhite), B: prepareTemplate(capBlack) };
  const standing = { A: prepareTemplate(uprightWhite), B: prepareTemplate(uprightBlack) };
  return {
    flat,
    standing,
    capstone,
    heights: {
      flat: measureHeight(flat.A),
      standing: measureHeight(standing.A),
      capstone: measureHeight(capstone.A),
    },
  };
}

let takPieceTheme: ThemeId = 'light';

function templateFor(templates: TakTemplates, piece: EnginePiece): THREE.Object3D {
  const shape = (piece.shape === 'standing' ? 'standing' : piece.shape === 'capstone' ? 'capstone' : 'flat') as ShapeKey;
  const side = pieceGlbSideForPlayer(takPieceTheme, piece.player);
  return templates[shape][side];
}

function mountModel(root: THREE.Group, model: THREE.Object3D) {
  root.clear();
  root.add(model);
}

/**
 * Load Alex uneven-stone GLBs; falls back to procedural {@link takPieceGeometrySet} on failure.
 */
export async function loadTakPieceGeometrySet(): Promise<PieceGeometrySet> {
  const fallbackGeos = createTakPieceGeometries();
  const fallback = takPieceGeometrySet(fallbackGeos);
  try {
    const templates = await buildTemplates();
    const shadowGeos = fallbackGeos;
    return {
      geometry(piece) {
        const shape = piece.shape === 'capstone' ? 'capstone' : 'flat';
        return shadowGeos[shape as keyof typeof shadowGeos] ?? shadowGeos.flat;
      },
      height(piece) {
        const shape = (piece.shape === 'standing' ? 'standing' : piece.shape === 'capstone' ? 'capstone' : 'flat') as ShapeKey;
        return templates.heights[shape];
      },
      geometryOrigin: 'base',
      yaw: fallback.yaw,
      edgeThreshold: BOARD.EDGE_THRESHOLD_TAK,
      useOutline: () => false,
      materialFor: () => null,
      createVisual(piece) {
        const root = new THREE.Group();
        const model = clonePieceVisualTemplate(templateFor(templates, piece));
        mountModel(root, model);
        return root;
      },
      replaceVisual(root, piece) {
        const model = clonePieceVisualTemplate(templateFor(templates, piece));
        mountModel(root as THREE.Group, model);
      },
      onThemeChange(id) {
        takPieceTheme = id;
      },
    };
  } catch (error) {
    console.warn('Tak GLB pieces failed to load; using procedural fallback.', error);
    return fallback;
  }
}

/** @internal Vitest: bbox stack step from a unit box mesh. */
export function testHeightFromUnitBox(scaleY: number): number {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, scaleY, 1));
  mesh.updateMatrixWorld(true);
  _box.setFromObject(mesh);
  return heightFromBoundingBox(_box);
}

export { geometryBoundingBoxHeight };
