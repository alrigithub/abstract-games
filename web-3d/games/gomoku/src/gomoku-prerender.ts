import * as THREE from 'three';
import {
  batchAuthoredMeshes,
  loadGltfAsync,
  tagArenaGlbForShadows,
  tagExcludeFromBounds,
  trackIfLoading,
  type PrerenderedArena,
} from '@abstract/three-engine';
import manifest from './gomoku-arena-manifest.json';

export const GOMOKU_PRERENDER_MANIFEST = manifest;

export interface GomokuPlateCell {
  name: string;
  row: number;
  col: number;
  x: number;
  y: number;
  z: number;
}

function asset(name: string): string {
  return `${import.meta.env.BASE_URL}prerender/${name}`;
}

export async function loadGomokuPrerender() {
  const loader = new THREE.TextureLoader();
  const [light, gltf] = await Promise.all([
    trackIfLoading(loader.loadAsync(asset('gomoku-light.webp')), 'Loading texture gomoku-light.webp'),
    loadGltfAsync(asset('gomoku-columns.glb')),
  ]);
  light.colorSpace = THREE.SRGBColorSpace;
  light.anisotropy = 8;
  const columns = gltf.scene;
  batchAuthoredMeshes(columns);
  tagExcludeFromBounds(columns);
  tagArenaGlbForShadows(columns);
  columns.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = false;
  });
  const plate: PrerenderedArena = { light, camera: manifest.camera, occluders: columns };
  return { columns, plate, cells: manifest.cells as GomokuPlateCell[] };
}
