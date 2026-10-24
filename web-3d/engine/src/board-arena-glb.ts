import * as THREE from 'three';
import { applyClayEnvMaterials } from './clay-materials';
import type { ThemeId } from './theme';
import { CLAY } from './constants';

export const ARENA_SHADOW_USER_DATA = 'arenaShadowSurface';

const ARENA_ROUGHNESS = 0.82;

function assignMeshMaterial(mesh: THREE.Mesh, next: THREE.Material | THREE.Material[]) {
  const prev = mesh.material;
  mesh.material = next;
  if (Array.isArray(prev)) prev.forEach(m => m.dispose());
  else if (prev instanceof THREE.Material) prev.dispose();
}

function matteArenaStandardMaterial(source: THREE.Material, color?: THREE.Color): THREE.Material {
  if (source instanceof THREE.MeshStandardMaterial || source instanceof THREE.MeshPhysicalMaterial) {
    const mat = source.clone();
    mat.map = null;
    mat.aoMap = null;
    mat.lightMap = null;
    mat.metalnessMap = null;
    mat.emissiveMap = null;
    mat.alphaMap = null;
    if (color) mat.color.copy(color);
    mat.emissive.setHex(0x000000);
    mat.metalness = 0;
    mat.roughness = ARENA_ROUGHNESS;
    mat.transparent = false;
    mat.opacity = 1;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.transmission = 0;
      mat.thickness = 0;
    }
    return mat;
  }
  if (source instanceof THREE.MeshBasicMaterial || source instanceof THREE.MeshLambertMaterial) {
    const resolved = color ?? source.color;
    return new THREE.MeshStandardMaterial({
      color: resolved,
      roughness: ARENA_ROUGHNESS,
      metalness: 0,
    });
  }
  return source.clone();
}

/** Ruins cast shadows; thin paving only receives them to avoid surface acne. */
export function tagArenaGlbForShadows(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  const size = new THREE.Vector3();
  const box = new THREE.Box3();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    box.setFromObject(node).getSize(size);
    node.userData[ARENA_SHADOW_USER_DATA] = true;
    node.castShadow = size.y > 0.18;
    node.receiveShadow = true;
  });
}

export interface ApplyArenaGlbThemeMaterialsOptions {
  /** When true, keep authored GLB materials (colours, textures) instead of shared clay ENV. */
  keepGlbMaterials?: boolean;
  /** Apply the menu palette while retaining authored normal/bump detail. */
  tintToTheme?: boolean;
}

/** Shared clay ENV material for authored arena / environment GLBs. */
export function applyArenaGlbThemeMaterials(
  root: THREE.Object3D,
  themeId: ThemeId,
  options: ApplyArenaGlbThemeMaterialsOptions = {},
): void {
  if (options.tintToTheme) {
    const color = new THREE.Color(themeId === 'light' ? CLAY.ENV : CLAY.ENV_DARK);
    root.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const tinted = Array.isArray(node.material)
        ? node.material.map(mat => matteArenaStandardMaterial(mat, color))
        : matteArenaStandardMaterial(node.material, color);
      assignMeshMaterial(node, tinted);
    });
    return;
  }
  if (options.keepGlbMaterials) return;
  applyClayEnvMaterials(root);
}

/** Matte PBR for arena GLBs that keep authored albedo (strips baked maps that tint under scene lighting). */
export function applyArenaGlbAuthoredMaterials(root: THREE.Object3D): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const mesh = node;
    if (Array.isArray(mesh.material)) {
      assignMeshMaterial(
        mesh,
        mesh.material.map(mat => matteArenaStandardMaterial(mat)),
      );
    } else {
      assignMeshMaterial(mesh, matteArenaStandardMaterial(mesh.material));
    }
  });
}
