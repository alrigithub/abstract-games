import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BOARD } from './constants';
import { createTzaarBoardSlabGeometry } from './geometries/hex-board';
import { createGomokuStoneGeometry, gomokuStoneRestCenterY } from './geometries/gomoku-pieces';
import { createYinshMarkerGeometry, createYinshRingGeometry, yinshPieceGeometrySet } from './geometries/yinsh-pieces';
import { createTakPieceGeometries, takPieceGeometrySet } from './geometries/tak-pieces';
import { layoutStackCenters, PLAYFIELD_SURFACE_Y } from './stack-layout';
import type { EnginePiece } from './types';

const box = new THREE.Box3();

function worldMinY(object: THREE.Object3D): number {
  object.updateMatrixWorld(true);
  box.setFromObject(object);
  return box.min.y;
}

function meshYFromStackCenter(centerY: number, piece: EnginePiece, set: { geometryOrigin?: string; height(p: EnginePiece): number }) {
  if (set.geometryOrigin === 'base') return centerY - set.height(piece) / 2;
  return centerY;
}

describe('flat board and piece grounding', () => {
  it('tzaar playfield slab is a flat plane at y=0', () => {
    const slab = createTzaarBoardSlabGeometry();
    slab.computeBoundingBox();
    expect(slab.boundingBox!.max.y).toBeCloseTo(BOARD.PLAYFIELD_SURFACE_Y, 5);
    expect(slab.boundingBox!.min.y).toBeCloseTo(BOARD.PLAYFIELD_SURFACE_Y, 5);
    slab.dispose();
  });

  it('gomoku stone base rests on y=0 when placed at rest Y', () => {
    const geo = createGomokuStoneGeometry();
    const mesh = new THREE.Mesh(geo);
    mesh.position.y = gomokuStoneRestCenterY();
    expect(worldMinY(mesh)).toBeCloseTo(PLAYFIELD_SURFACE_Y, 4);
  });

  it('yinsh ring stack base meets the playfield with base geometry origin', () => {
    const ring = createYinshRingGeometry();
    const marker = createYinshMarkerGeometry();
    const set = yinshPieceGeometrySet(ring, marker);
    const piece: EnginePiece = { id: 'r', player: 'A', shape: 'ring' };
    const [centerY] = layoutStackCenters([piece], {
      heightOf: p => set.height(p),
      offsetOf: (p, i, s) => set.verticalOffset?.(p, i, s) ?? 0,
    });
    const mesh = new THREE.Mesh(ring);
    mesh.position.y = meshYFromStackCenter(centerY!, piece, set);
    expect(worldMinY(mesh)).toBeCloseTo(PLAYFIELD_SURFACE_Y, 4);
  });

  it('tak flat piece stack base meets the playfield', () => {
    const geos = createTakPieceGeometries();
    const set = takPieceGeometrySet(geos);
    const piece: EnginePiece = { id: 't', player: 'A', shape: 'flat' };
    const [centerY] = layoutStackCenters([piece], {
      heightOf: p => set.height(p),
      offsetOf: () => 0,
    });
    const mesh = new THREE.Mesh(geos.flat);
    mesh.position.y = meshYFromStackCenter(centerY!, piece, set);
    expect(worldMinY(mesh)).toBeCloseTo(PLAYFIELD_SURFACE_Y, 4);
  });
});
