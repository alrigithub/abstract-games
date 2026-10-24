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

const MODEL = {
  tzaarWhite: 'models/tzaar-tzaar-white.glb',
  tzaarBlack: 'models/tzaar-tzaar-black.glb',
  tzarraWhite: 'models/tzaar-tzarra-white.glb',
  tzarraBlack: 'models/tzaar-tzarra-black.glb',
  tottWhite: 'models/tzaar-tott-white.glb',
  tottBlack: 'models/tzaar-tott-black.glb',
} as const;

type KindKey = TzaarKind;

interface TzaarTemplates {
  tzaar: { A: THREE.Object3D; B: THREE.Object3D };
  tzarra: { A: THREE.Object3D; B: THREE.Object3D };
  tott: { A: THREE.Object3D; B: THREE.Object3D };
}

const _box = new THREE.Box3();

function modelUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const origin = globalThis.location?.href ?? 'http://127.0.0.1/';
  return new URL(`${prefix}${path}`, origin).href;
}

function kindOf(piece: EnginePiece): KindKey {
  return piece.shape === 'tzaar' || piece.shape === 'tzarra' ? piece.shape : 'tott';
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
  root.position.y -= TZAAR_GLB_STACK_STEP / 2;
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
    loadScene(modelUrl(MODEL.tzaarWhite)),
    loadScene(modelUrl(MODEL.tzaarBlack)),
    loadScene(modelUrl(MODEL.tzarraWhite)),
    loadScene(modelUrl(MODEL.tzarraBlack)),
    loadScene(modelUrl(MODEL.tottWhite)),
    loadScene(modelUrl(MODEL.tottBlack)),
  ]);
  return {
    tzaar: { A: prepareTemplate(tzaarWhite), B: prepareTemplate(tzaarBlack) },
    tzarra: { A: prepareTemplate(tzarraWhite), B: prepareTemplate(tzarraBlack) },
    tott: { A: prepareTemplate(tottWhite), B: prepareTemplate(tottBlack) },
  };
}

function templateFor(templates: TzaarTemplates, piece: EnginePiece): THREE.Object3D {
  const side = piece.player === 'B' ? 'B' : 'A';
  return templates[kindOf(piece)][side];
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
    return {
      geometry: () => shadowGeo,
      height: () => TZAAR_GLB_STACK_STEP,
      yaw: fallback.yaw,
      useOutline: () => false,
      materialFor: () => null,
      createVisual(piece) {
        const root = new THREE.Group();
        mountModel(root, templateFor(templates, piece).clone(true));
        return root;
      },
      replaceVisual(root, piece) {
        mountModel(root as THREE.Group, templateFor(templates, piece).clone(true));
      },
    };
  } catch (error) {
    console.warn('Tzaar GLB pieces failed to load; using procedural fallback.', error);
    return fallback;
  }
}

export { TZAAR_GLB_STACK_STEP, TZAAR_GLB_WORLD_SCALE };
