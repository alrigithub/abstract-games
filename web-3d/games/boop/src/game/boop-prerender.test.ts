import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BOOP_PRERENDER_MANIFEST as manifest, batchBoopColumns, createBoopPrerenderTopology } from './boop-prerender';
import type { BoardSnapshot } from '@abstract/three-engine';

const snapshot: BoardSnapshot = { cells: [], cellCount: 324, playableCells: 36 };
describe('Boop Blender grid registration', () => {
  it('batches UV-mapped bases and non-UV column shafts without moving their silhouettes', () => {
    const root = new THREE.Group();
    root.position.set(2, 0, 1);
    const material = new THREE.MeshStandardMaterial();
    const base = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const shaftGeometry = new THREE.CylinderGeometry(.3, .3, 2).toNonIndexed();
    shaftGeometry.deleteAttribute('uv');
    const shaft = new THREE.Mesh(shaftGeometry, material);
    shaft.position.set(3, 1, -2);
    root.add(base, shaft);
    root.updateMatrixWorld(true);
    const before = new THREE.Box3().setFromObject(root);
    batchBoopColumns(root);
    expect(root.children.length).toBe(1);
    const after = new THREE.Box3().setFromObject(root);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-6);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-6);
  });
  it('matches all 36 source cells exactly and picks the displaced cells at their own centers', () => {
    const topology = createBoopPrerenderTopology({ size: 6, outsideRows: 6 }, new THREE.Group());
    expect(manifest.referenceCellCount).toBe(36);
    expect(manifest.maxSourceAlignmentError).toBeLessThan(1e-5);
    const indices = new Set<number>();
    for (const cell of manifest.cells) {
      const index = cell.row * 6 + cell.col;
      indices.add(index);
      expect(topology.cellPosition(index, snapshot).toArray()).toEqual([cell.x, cell.y, cell.z]);
      expect(topology.cellAtWorld(cell.x, cell.z, snapshot)).toBe(index);
      expect(topology.projectCell(index, snapshot).y).toBe(cell.y);
    }
    expect(indices.size).toBe(36);
    expect(manifest.liveColumns.filter(name => name.includes('Ancient fractured column')).length).toBe(4);
    expect(manifest.staticMeshCount).toBeGreaterThan(200);
  });
  it('preserves exterior pool coordinates', () => {
    const topology = createBoopPrerenderTopology({ size: 6, outsideRows: 6 }, new THREE.Group());
    const index = topology.cellAtWorld(-5.5, -2.5, snapshot);
    expect(index).not.toBeNull();
    if (index === null) throw new Error('Missing pool cell');
    expect(topology.cellPosition(index, snapshot).toArray()).toEqual([-5.5, 0, -2.5]);
  });
});
