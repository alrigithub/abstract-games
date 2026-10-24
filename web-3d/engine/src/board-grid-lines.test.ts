import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { boardGridLineScreenScale, boardGridLineWorldWidth } from './board-grid-lines';
import { BOARD } from './constants';

describe('board grid line screen scale', () => {
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
  camera.zoom = 1;

  it('doubles world width when zoom halves', () => {
    const h = 720;
    camera.zoom = 1;
    const w1 = boardGridLineWorldWidth(camera, h);
    camera.zoom = 0.5;
    const w2 = boardGridLineWorldWidth(camera, h);
    expect(w2).toBeCloseTo(w1 * 2, 6);
  });

  it('keeps apparent width stable via inverse scale on tagged meshes', () => {
    camera.zoom = 2;
    const s = boardGridLineScreenScale(camera, 720);
    expect(s * BOARD.LINE_W).toBeCloseTo(boardGridLineWorldWidth(camera, 720), 6);
  });
});
