import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createPrerenderedArena, fitPrerenderedCamera, lockedPlateZoomLimits } from './prerendered-arena';

describe('registered pre-render camera', () => {
  it.each([
    { aspect: 600 / 900, zoom: .85 },
    { aspect: 600 / 900, zoom: .4 },
    { aspect: 16 / 9, zoom: .85 },
  ])('keeps authored features aligned with live geometry at $aspect aspect and $zoom zoom', ({ aspect, zoom }) => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    try {
      const spec = {
        position: [12.743015237470523, 12.618681599723013, 12.743015237470523],
        target: [0, 0, 0], width: 18, height: 18, frameWidth: 14, frameHeight: 10,
      };
      const scene = new THREE.Scene();
      const first = new THREE.Texture();
      const second = new THREE.Texture();
      const arena = createPrerenderedArena(scene, { light: first, camera: spec });
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
      fitPrerenderedCamera(camera, spec, aspect, zoom);
      const authored = new THREE.OrthographicCamera(-9, 9, 9, -9, .1, 100);
      authored.position.fromArray(spec.position);
      authored.lookAt(new THREE.Vector3());
      authored.updateMatrixWorld(true);
      const plate = scene.getObjectByName('pre-rendered-static-arena') as THREE.Mesh;
      const ray = new THREE.Raycaster();
      for (const texture of [first, second]) {
        arena.setTexture(texture);
        arena.cover(camera);
        plate.updateMatrixWorld(true);
        texture.updateMatrix();
        // Cast through the screen position of each live column/grid feature,
        // then verify the plate samples the exact pixel baked for that feature.
        for (const world of [new THREE.Vector3(-3, 1.7, -3), new THREE.Vector3(3, .1, 3), new THREE.Vector3(0, 2.2, 3)]) {
          const screen = world.clone().project(camera);
          ray.setFromCamera(new THREE.Vector2(screen.x, screen.y), camera);
          const hit = ray.intersectObject(plate)[0];
          expect(hit?.uv).toBeDefined();
          const sampled = hit!.uv!.clone().applyMatrix3(texture.matrix);
          const original = world.clone().project(authored);
          expect(sampled.x).toBeCloseTo((original.x + 1) / 2, 8);
          expect(sampled.y).toBeCloseTo((original.y + 1) / 2, 8);
        }
      }
      expect(camera.zoom).toBe(zoom);
      arena.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('swaps the plate and letterboxing without resetting camera zoom or placement', () => {
    let corner = [255, 255, 255, 255];
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => ({
        drawImage(image: { corner: number[] }) { corner = image.corner; },
        getImageData: () => ({ data: corner }),
      }) }),
    });
    try {
      const first = new THREE.Texture({ corner: [250, 250, 250, 255] });
      const second = new THREE.Texture({ corner: [220, 210, 190, 255] });
      const firstDispose = vi.spyOn(first, 'dispose');
      const secondDispose = vi.spyOn(second, 'dispose');
      const scene = new THREE.Scene();
      const arena = createPrerenderedArena(scene, {
        light: first, camera: { position: [12, 12, 12], target: [0, 0, 0], width: 18, height: 18 },
      });
      const camera = new THREE.OrthographicCamera(-12, 12, 10, -10, .1, 80);
      camera.zoom = .9;
      arena.cover(camera);
      const plate = scene.getObjectByName('pre-rendered-static-arena') as THREE.Mesh;
      plate.updateMatrix();
      const before = plate.matrix.clone();
      const repeat = first.repeat.clone();
      const offset = first.offset.clone();
      arena.setTexture(second);
      arena.cover(camera);
      plate.updateMatrix();
      expect((plate.material as THREE.MeshBasicMaterial).map).toBe(second);
      expect((plate.material as THREE.MeshBasicMaterial).toneMapped).toBe(false);
      expect(camera.zoom).toBe(.9);
      expect(plate.matrix.equals(before)).toBe(true);
      expect(second.repeat.equals(repeat)).toBe(true);
      expect(second.offset.equals(offset)).toBe(true);
      expect((scene.background as THREE.Color).getHex()).toBe(0xdcd2be);
      expect(firstDispose).not.toHaveBeenCalled();
      arena.dispose();
      expect(firstDispose).toHaveBeenCalledOnce();
      expect(secondDispose).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  const spec = { position: [12, 12, 12], target: [0, 0, 0], width: 18, height: 18 };
  it.each([16 / 9, 1, 9 / 16])('keeps the complete image and world geometry registered at aspect %s', aspect => {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 80);
    camera.zoom = 4;
    fitPrerenderedCamera(camera, spec, aspect);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const corner = right.multiplyScalar(9).addScaledVector(up, 9).project(camera);
    expect(Math.abs(corner.x)).toBeLessThanOrEqual(1.000001);
    expect(Math.abs(corner.y)).toBeLessThanOrEqual(1.000001);
    expect(Math.max(Math.abs(corner.x), Math.abs(corner.y))).toBeCloseTo(1);
    expect(Math.abs(corner.x / corner.y)).toBeCloseTo(1 / aspect);
    expect(camera.position.toArray()).toEqual(spec.position);
    expect(camera.zoom).toBe(1);
    fitPrerenderedCamera(camera, spec, aspect, 1.35);
    expect(camera.zoom).toBeCloseTo(1.35);
    expect(camera.position.toArray()).toEqual(spec.position);
    // A live object's projected point round-trips to the same world position.
    const world = new THREE.Vector3(2.5, .12, -1.5);
    expect(world.clone().project(camera).unproject(camera).distanceTo(world)).toBeLessThan(1e-10);
  });

  it('caps locked-plate zoom from the plate resolution', () => {
    const boop = lockedPlateZoomLimits(1536);
    const gomoku = lockedPlateZoomLimits(2048);
    expect(boop.min).toBeLessThan(1);
    expect(boop.max).toBeGreaterThan(1);
    expect(boop.max).toBeLessThanOrEqual(2);
    expect(gomoku.max).toBeGreaterThan(boop.max);
  });
});
