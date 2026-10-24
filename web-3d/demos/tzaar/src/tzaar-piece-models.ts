import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  TZAAR_GLB_STACK_STEP,
  TZAAR_GLB_WORLD_SCALE,
  createTzaarDiscGeometry,
  tzaarPieceGeometrySet,
  type EnginePiece,
  type PieceGeometrySet,
  type TzaarKind,
} from '@abstract/three-engine';

/** One GLB per type × colour. Player A is ivory, B is black. */
export const TZAAR_MODEL = {
  tzaarWhite: 'models/tzaar-tzaar-white.glb',
  tzaarBlack: 'models/tzaar-tzaar-black.glb',
  tzarraWhite: 'models/tzaar-tzarra-white.glb',
  tzarraBlack: 'models/tzaar-tzarra-black.glb',
  tottWhite: 'models/tzaar-tott-white.glb',
  tottBlack: 'models/tzaar-tott-black.glb',
} as const;

export type TzaarStoneSide = 'A' | 'B';

type KindKey = TzaarKind;

interface TzaarTemplates {
  tzaar: { A: THREE.Object3D; B: THREE.Object3D };
  tzarra: { A: THREE.Object3D; B: THREE.Object3D };
  tott: { A: THREE.Object3D; B: THREE.Object3D };
}

const _box = new THREE.Box3();

export function tzaarKindOf(piece: EnginePiece): KindKey {
  return piece.shape === 'tzaar' || piece.shape === 'tzarra' ? piece.shape : 'tott';
}

export function tzaarModelRelPath(kind: KindKey, side: TzaarStoneSide): string {
  if (kind === 'tzaar') return side === 'B' ? TZAAR_MODEL.tzaarBlack : TZAAR_MODEL.tzaarWhite;
  if (kind === 'tzarra') return side === 'B' ? TZAAR_MODEL.tzarraBlack : TZAAR_MODEL.tzarraWhite;
  return side === 'B' ? TZAAR_MODEL.tottBlack : TZAAR_MODEL.tottWhite;
}

function modelUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const origin = globalThis.location?.href ?? 'http://127.0.0.1/';
  return new URL(`${prefix}${path}`, origin).href;
}

/** sRGB/linear map setup only — stone-mixed-final albedo and PBR stay as authored. */
export function configureTzaarStoneMaterials(object: THREE.Object3D, _side?: TzaarStoneSide): void {
  object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of mats) {
      if (mat instanceof THREE.MeshPhysicalMaterial || mat instanceof THREE.MeshStandardMaterial) {
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        if (mat.normalMap) mat.normalMap.colorSpace = THREE.LinearSRGBColorSpace;
        mat.envMapIntensity = 1;
        mat.needsUpdate = true;
        continue;
      }
      if (mat instanceof THREE.MeshBasicMaterial) {
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.needsUpdate = true;
      }
    }
  });
}

function anchorObjectBaseToY0(object: THREE.Object3D): void {
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  if (Number.isFinite(_box.min.y)) object.position.y -= _box.min.y;
  object.updateMatrixWorld(true);
}

/**
 * Scale the authored GLB (origin at base centre) and shift so the visual root
 * origin is at the piece centre — matching engine stack-layout centers.
 */
function prepareTemplate(scene: THREE.Object3D): THREE.Object3D {
  const root = scene.clone(true);
  root.scale.setScalar(TZAAR_GLB_WORLD_SCALE);
  root.updateMatrixWorld(true);
  anchorObjectBaseToY0(root);
  configureTzaarStoneMaterials(root);
  root.updateMatrixWorld(true);
  return root;
}

async function loadScene(url: string): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

async function buildTemplates(): Promise<TzaarTemplates> {
  const [tzaarWhite, tzaarBlack, tzarraWhite, tzarraBlack, tottWhite, tottBlack] = await Promise.all([
    loadScene(modelUrl(TZAAR_MODEL.tzaarWhite)),
    loadScene(modelUrl(TZAAR_MODEL.tzaarBlack)),
    loadScene(modelUrl(TZAAR_MODEL.tzarraWhite)),
    loadScene(modelUrl(TZAAR_MODEL.tzarraBlack)),
    loadScene(modelUrl(TZAAR_MODEL.tottWhite)),
    loadScene(modelUrl(TZAAR_MODEL.tottBlack)),
  ]);
  return {
    tzaar: { A: prepareTemplate(tzaarWhite), B: prepareTemplate(tzaarBlack) },
    tzarra: { A: prepareTemplate(tzarraWhite), B: prepareTemplate(tzarraBlack) },
    tott: { A: prepareTemplate(tottWhite), B: prepareTemplate(tottBlack) },
  };
}

function templateFor(templates: TzaarTemplates, piece: EnginePiece): THREE.Object3D {
  const side: TzaarStoneSide = piece.player === 'B' ? 'B' : 'A';
  return templates[tzaarKindOf(piece)][side];
}

function mountModel(root: THREE.Group, model: THREE.Object3D) {
  root.clear();
  root.add(model);
}

/**
 * Load Alex stone GLBs via {@link PieceGeometrySet.createVisual} / {@link PieceGeometrySet.replaceVisual}.
 * Falls back to procedural {@link tzaarPieceGeometrySet} on failure.
 */
export async function loadTzaarPieceGeometrySet(): Promise<PieceGeometrySet> {
  const fallback = tzaarPieceGeometrySet();
  const shadowGeo = createTzaarDiscGeometry();
  try {
    const templates = await buildTemplates();
    const measureTemplate = templateFor(templates, { id: 'm', player: 'A', shape: 'tott' });
    _box.setFromObject(measureTemplate);
    const visualHeight = _box.max.y - _box.min.y;
    return {
      geometry: () => shadowGeo,
      height: () => visualHeight,
      geometryOrigin: 'base',
      yaw: fallback.yaw,
      useOutline: () => false,
      materialFor: () => null,
      createVisual(piece) {
        const root = new THREE.Group();
        const model = templateFor(templates, piece).clone(true);
        configureTzaarStoneMaterials(model);
        mountModel(root, model);
        return root;
      },
      replaceVisual(root, piece) {
        const model = templateFor(templates, piece).clone(true);
        configureTzaarStoneMaterials(model);
        mountModel(root as THREE.Group, model);
      },
    };
  } catch (error) {
    console.warn('Tzaar GLB pieces failed to load; using procedural fallback.', error);
    return fallback;
  }
}

export { TZAAR_GLB_STACK_STEP, TZAAR_GLB_WORLD_SCALE };
