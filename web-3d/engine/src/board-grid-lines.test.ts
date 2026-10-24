import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyBoardGridLineScreenScale,
  boardGridLineScreenScale,
  boardGridLineWorldWidth,
  boardGridLineWorldY,
  tagBoardGridLine,
} from './board-grid-lines';
import { BOARD } from './constants';

describe('board grid line screen scale', () => {
  it('sits grid lines slightly above the playfield surface', () => {
    expect(boardGridLineWorldY()).toBe(BOARD.PLAYFIELD_SURFACE_Y + BOARD.LINE_LIFT);
    expect(BOARD.LINE_Y).toBe(boardGridLineWorldY());
  });

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

  it('scales thickness axis only so line length stays fixed', () => {
    const group = new THREE.Group();
    const h = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.LINE_W, 10));
    h.rotation.x = -Math.PI / 2;
    tagBoardGridLine(h, { thicknessAxis: 'z' });
    group.add(h);
    applyBoardGridLineScreenScale(group, 2);
    expect(h.scale.x).toBe(1);
    expect(h.scale.y).toBe(2);
    expect(h.scale.z).toBe(1);
  });
});
