import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSquareTopology, loadGltfAsync, tagArenaGlbForShadows, tagExcludeFromBounds, type SquareGridOptions, type Topology, type PrerenderedArena } from '@abstract/three-engine';
import manifest from './boop-arena-manifest.json';
import { loadBoopShadowGeometry } from './boop-stone-cats';

export const BOOP_PRERENDER_MANIFEST = manifest;

/** Match the invisible depth/shadow floor to Blender's actual arena opening. */
export function createBoopGroundGeometry(size: number): THREE.BufferGeometry {
  const cut = manifest.groundCutout;
  const half = size / 2;
  const parts: THREE.BufferGeometry[] = [];
  function rectangle(x0: number, x1: number, z0: number, z1: number, y = 0) {
    const plane = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    plane.rotateX(-Math.PI / 2);
    plane.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    parts.push(plane);
  }
  rectangle(-half, half, -half, cut.minZ);
  rectangle(-half, half, cut.maxZ, half);
  rectangle(-half, cut.minX, cut.minZ, cut.maxZ);
  rectangle(cut.maxX, half, cut.minZ, cut.maxZ);
  rectangle(cut.minX, cut.maxX, cut.minZ, cut.maxZ, cut.floorY);
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error('Could not create recessed Boop ground');
  return geometry;
}

function asset(name: string): string {
  return `${import.meta.env.BASE_URL}prerender/${name}`;
}

export function batchBoopColumns(columns: THREE.Group): void {
  columns.updateMatrixWorld(true);
  const inverse = columns.matrixWorld.clone().invert();
  const parts: THREE.BufferGeometry[] = [];
  let material: THREE.Material | undefined;
  columns.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (Array.isArray(node.material)) throw new Error('Expected one shared column material');
    material ??= node.material;
    let geometry = node.geometry.clone();
    // Column shafts and Blender cubes have different UV/index layouts. These
    // matte exports have no maps, so only positions and normals are needed.
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    if (geometry.index) {
      const indexed = geometry;
      geometry = indexed.toNonIndexed();
      indexed.dispose();
    }
    parts.push(geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld)));
  });
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged || !material) throw new Error('Missing Boop live columns');
  columns.clear();
  columns.add(new THREE.Mesh(merged, material));
}

export async function loadBoopPrerender() {
  const loader = new THREE.TextureLoader();
  const [light, dark, gltf, cat, kitten] = await Promise.all([
    loader.loadAsync(asset('boop-light.webp')),
    loader.loadAsync(asset('boop-dark.webp')),
    loadGltfAsync(asset('boop-columns.glb')),
    loadBoopShadowGeometry(asset('boop-cat-shadow.glb')),
    loadBoopShadowGeometry(asset('boop-kitten-shadow.glb')),
  ]);
  for (const texture of [light, dark]) texture.colorSpace = THREE.SRGBColorSpace;
  const columns = gltf.scene;
  batchBoopColumns(columns);
  tagExcludeFromBounds(columns);
  tagArenaGlbForShadows(columns);
  columns.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    // Static column shadows are already in the plate; live pieces still shadow the columns.
    node.castShadow = false;
  });
  const plate: PrerenderedArena = { light, dark, camera: manifest.camera, occluders: columns };
  return { columns, plate, shadows: { cat, kitten } };
}

export function createBoopPrerenderTopology(options: SquareGridOptions, columns: THREE.Object3D): Topology {
  const base = createSquareTopology(options);
  const cells = new Map(manifest.cells.map(cell => [cell.row * 6 + cell.col, cell]));
  function center(index: number, snapshot: Parameters<Topology['cellPosition']>[1]) {
    const cell = cells.get(index);
    return cell ? new THREE.Vector3(cell.x, cell.y, cell.z) : base.cellPosition(index, snapshot);
  }
  return {
    ...base,
    cellPosition: center,
    projectCell: center,
    cellAtWorld(x, z, snapshot) {
      const match = manifest.cells
        .filter(c => Math.abs(x - c.x) <= .51 && Math.abs(z - c.z) <= .51)
        .sort((a, b) => Math.hypot(x - a.x, z - a.z) - Math.hypot(x - b.x, z - b.z))[0];
      if (match) return match.row * 6 + match.col;
      const outside = base.cellAtWorld(x, z, snapshot);
      return outside !== null && outside >= 36 ? outside : null;
    },
    buildBoard(ctx) {
      for (const child of ctx.board.children) {
        if (!(child instanceof THREE.Mesh) || !child.userData.playfieldGround) continue;
        child.geometry.computeBoundingBox();
        const box = child.geometry.boundingBox!;
        child.geometry = createBoopGroundGeometry(box.max.x - box.min.x);
        ctx.boardGeometries.push(child.geometry);
      }
      ctx.board.add(columns.clone(true));
      // Two batched low-poly surfaces provide depth/AO and live shadows over the image.
      const parts = manifest.cells.map(c => {
        const geometry = new THREE.PlaneGeometry(.94, .94);
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(c.x, c.y, c.z);
        return geometry;
      });
      const geometry = mergeGeometries(parts);
      for (const part of parts) part.dispose();
      if (!geometry) throw new Error('Could not create Boop shadow surfaces');
      ctx.boardGeometries.push(geometry);
      const depth = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false }));
      depth.name = 'boop-tile-depth-proxy';
      depth.renderOrder = -1;
      const shadow = new THREE.Mesh(geometry, new THREE.ShadowMaterial({ opacity: .22, depthWrite: false }));
      shadow.name = 'boop-tile-shadow-receiver';
      shadow.position.y = .001;
      tagArenaGlbForShadows(shadow);
      shadow.castShadow = false;
      ctx.board.add(depth, shadow);
      return true;
    },
  };
}
