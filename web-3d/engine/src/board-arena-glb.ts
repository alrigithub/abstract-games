import * as THREE from 'three';
import { applyClayEnvMaterials } from './clay-materials';
import type { ThemeId } from './theme';

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

/** Arena GLB: receive piece shadows; env geometry does not cast (avoids acne / dark bands on tiles). */
export function tagArenaGlbForShadows(root: THREE.Object3D): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = false;
    node.receiveShadow = true;
  });
}

export interface ApplyArenaGlbThemeMaterialsOptions {
  /** When true, keep authored GLB materials (colours, textures) instead of shared clay ENV. */
  keepGlbMaterials?: boolean;
}

/** Shared clay ENV material for authored arena / environment GLBs. */
export function applyArenaGlbThemeMaterials(
  root: THREE.Object3D,
  _themeId: ThemeId,
  options: ApplyArenaGlbThemeMaterialsOptions = {},
): void {
  void _themeId;
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
