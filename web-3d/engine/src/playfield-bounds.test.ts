import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BOARD } from './constants';
import { createPlayfieldGroundMesh } from './playfield-ground';
import {
  box3FromPlayfieldContent,
  expandBoxByPlayfieldContent,
  isExcludedFromBounds,
  tagExcludeFromBounds,
} from './playfield-bounds';

describe('playfield-bounds', () => {
  it('excludes tagged ground and decorative meshes from box expansion', () => {
    const root = new THREE.Group();
    const ground = createPlayfieldGroundMesh(new THREE.MeshBasicMaterial());
    root.add(ground);

    const play = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2));
    play.position.set(0, 0.1, 0);
    root.add(play);

    const deco = new THREE.Mesh(new THREE.PlaneGeometry(200, 200));
    tagExcludeFromBounds(deco);
    root.add(deco);

    expect(isExcludedFromBounds(ground)).toBe(true);
    expect(isExcludedFromBounds(deco)).toBe(true);

    const box = box3FromPlayfieldContent(root);
    expect(box.max.x - box.min.x).toBeLessThan(10);
    expect(box.max.x - box.min.x).toBeGreaterThan(1);
  });

  it('does not expand to the 8192 playfield ground plane', () => {
    const root = new THREE.Group();
    root.add(createPlayfieldGroundMesh(new THREE.MeshBasicMaterial()));
    const box = new THREE.Box3();
    expandBoxByPlayfieldContent(box, root);
    expect(box.isEmpty()).toBe(true);
    expect(BOARD.PLAYFIELD_GROUND_SIZE).toBeGreaterThan(1000);
  });
});
