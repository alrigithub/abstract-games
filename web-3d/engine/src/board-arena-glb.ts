import * as THREE from 'three';
import { themeTokens, type ThemeId } from './theme';

const ARENA_ROUGHNESS = 0.91;

function retintStandardMaterial(source: THREE.Material, color: THREE.Color): THREE.Material {
  if (source instanceof THREE.MeshStandardMaterial || source instanceof THREE.MeshPhysicalMaterial) {
    const mat = source.clone();
    mat.map = null;
    mat.metalnessMap = null;
    mat.emissiveMap = null;
    mat.alphaMap = null;
    mat.color.copy(color);
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
    return new THREE.MeshStandardMaterial({
      color,
      roughness: ARENA_ROUGHNESS,
      metalness: 0,
    });
  }
  return source.clone();
}

function assignMeshMaterial(mesh: THREE.Mesh, next: THREE.Material | THREE.Material[]) {
  const prev = mesh.material;
  mesh.material = next;
  if (Array.isArray(prev)) prev.forEach(m => m.dispose());
  else if (prev instanceof THREE.Material) prev.dispose();
}

/** Arena GLB tiles, rubble, and columns cast and receive directional shadows. */
export function tagArenaGlbForShadows(root: THREE.Object3D): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

/** Theme-tinted matte PBR for authored arena meshes (keeps normal/ao maps when present). */
export function applyArenaGlbThemeMaterials(root: THREE.Object3D, themeId: ThemeId): void {
  const color = new THREE.Color(themeTokens(themeId).arenaSurface);
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const mesh = node;
    if (Array.isArray(mesh.material)) {
      assignMeshMaterial(
        mesh,
        mesh.material.map(mat => retintStandardMaterial(mat, color)),
      );
    } else {
      assignMeshMaterial(mesh, retintStandardMaterial(mesh.material, color));
    }
  });
}
