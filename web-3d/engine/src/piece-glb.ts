import * as THREE from 'three';
import { PIECE_SKIP_CAST_SHADOW_USER_DATA, setMeshShadowFlags } from './board-lighting';
import { cloneMeshMaterials } from './ghost-visual';

/** White stone exports use KHR_materials_unlit; let them share the scene lighting. */
function lightWhiteStoneMaterial(source: THREE.Material): THREE.Material {
  if (!(source instanceof THREE.MeshBasicMaterial) || !/white/i.test(source.name)) return source;
  const material = new THREE.MeshStandardMaterial({
    name: source.name,
    color: source.color,
    map: source.map,
    side: source.side,
    vertexColors: source.vertexColors,
    roughness: 0.9,
    metalness: 0,
    opacity: source.opacity,
    transparent: source.transparent,
    alphaMap: source.alphaMap,
    alphaTest: source.alphaTest,
    depthTest: source.depthTest,
    depthWrite: source.depthWrite,
  });
  source.dispose(); // The source was isolated below; textures remain shared and intact.
  return material;
}

/** Every mesh in an authored piece GLB casts and receives directional shadows. */
export function tagPieceGlbMeshesForShadows(root: THREE.Object3D): void {
  setMeshShadowFlags(
    root,
    { cast: true, receive: true },
    mesh => !mesh.userData[PIECE_SKIP_CAST_SHADOW_USER_DATA],
  );
  root.traverse(node => {
    if (node instanceof THREE.LineSegments) {
      node.castShadow = false;
      node.receiveShadow = false;
    }
  });
}

/** After load: isolate materials and configure shadows before templating. */
export function prepareAuthoredPieceGlb(root: THREE.Object3D): void {
  cloneMeshMaterials(root);
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.material = Array.isArray(node.material)
      ? node.material.map(lightWhiteStoneMaterial)
      : lightWhiteStoneMaterial(node.material);
    if (!node.geometry.getAttribute('normal')) node.geometry.computeVertexNormals();
  });
  tagPieceGlbMeshesForShadows(root);
}
