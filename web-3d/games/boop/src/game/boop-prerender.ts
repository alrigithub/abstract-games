import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { batchAuthoredMeshes, createPrerenderTileProxies, createSquareTopology, loadGltfAsync, tagArenaGlbForShadows, tagExcludeFromBounds, trackIfLoading, type SquareGridOptions, type Topology, type PrerenderedArena } from '@abstract/three-engine';
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
  batchAuthoredMeshes(columns);
}

export async function loadBoopPrerender() {
  const loader = new THREE.TextureLoader();
  const [light, gltf, cat, kitten] = await Promise.all([
    trackIfLoading(loader.loadAsync(asset('boop-light.webp')), 'Loading texture boop-light.webp'),
    loadGltfAsync(asset('boop-columns.glb')),
    loadBoopShadowGeometry(asset('boop-cat-shadow.glb')),
    loadBoopShadowGeometry(asset('boop-kitten-shadow.glb')),
  ]);
  light.colorSpace = THREE.SRGBColorSpace;
  const columns = gltf.scene;
  batchBoopColumns(columns);
  tagExcludeFromBounds(columns);
  tagArenaGlbForShadows(columns);
  columns.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    // Static column shadows are already in the plate; live pieces still shadow the columns.
    node.castShadow = false;
  });
  const plate: PrerenderedArena = { light, camera: manifest.camera, occluders: columns };
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
      const proxies = createPrerenderTileProxies(manifest.cells);
      proxies.depth.name = 'boop-tile-depth-proxy';
      proxies.shadow.name = 'boop-tile-shadow-receiver';
      ctx.boardGeometries.push(proxies.depth.geometry as THREE.BufferGeometry);
      ctx.board.add(proxies.depth, proxies.shadow);
      return true;
    },
  };
}
