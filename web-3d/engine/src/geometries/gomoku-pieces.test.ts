import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GOMOKU_DIMS,
  GOMOKU_GLB_DIAMETER_M,
  GOMOKU_GLB_WORLD_SCALE,
  createGomokuStoneGeometry,
  gomokuGlbStoneHeight,
  gomokuStoneRestCenterY,
} from './gomoku-pieces';

describe('gomoku GLB constants', () => {
  it('scales authored diameter to STONE_R', () => {
    expect(GOMOKU_GLB_WORLD_SCALE * (GOMOKU_GLB_DIAMETER_M / 2)).toBeCloseTo(GOMOKU_DIMS.STONE_R, 8);
    expect(gomokuGlbStoneHeight()).toBeGreaterThan(0);
  });
});

describe('createGomokuStoneGeometry', () => {
  it('is a smooth biconvex lens with poles at y=0 and y=height', () => {
    const geo = createGomokuStoneGeometry();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(box.max.y).toBeCloseTo(GOMOKU_DIMS.STONE_H, 3);
    expect(box.max.x).toBeCloseTo(GOMOKU_DIMS.STONE_R, 2);
  });

  it('rest Y places the stone base on the playfield', () => {
    expect(gomokuStoneRestCenterY()).toBeCloseTo(0, 6);
  });

  it('has outward-facing normals (no majority inverted on equator)', () => {
    const geo = createGomokuStoneGeometry();
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const norm = geo.getAttribute('normal') as THREE.BufferAttribute;
    let outward = 0;
    let inward = 0;
    const half = GOMOKU_DIMS.STONE_H / 2;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (Math.abs(y - half) > 0.02) continue;
      const x = pos.getX(i);
      if (x < GOMOKU_DIMS.STONE_R * 0.85) continue;
      const nx = norm.getX(i);
      if (nx > 0.05) outward++;
      if (nx < -0.05) inward++;
    }
    expect(outward).toBeGreaterThan(inward);
  });
});
