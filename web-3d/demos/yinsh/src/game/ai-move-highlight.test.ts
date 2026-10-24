import { describe, expect, it } from 'vitest';
import { Board } from './board';
import { coordNew } from './coord';
import {
  aiMovePathEndsAtDestination,
  applyRingLandingToPathWorld,
  buildAiMovePathCells,
  buildAiMovePathWorld,
  ringPieceId,
} from './ai-move-highlight';
import { coordToIndex } from './cells';

describe('AI last-move highlight path', () => {
  it('path cells run from start intersection through to landing cell', () => {
    const start = coordNew(0, 0);
    const end = coordNew(0, -3);
    const cells = buildAiMovePathCells(start, end);
    expect(cells[0]).toBe(coordToIndex(start));
    expect(aiMovePathEndsAtDestination(cells, coordToIndex(end))).toBe(true);
  });

  it('path world ends at ring mesh position when landing override is applied', () => {
    const start = coordNew(-1, 1);
    const end = coordNew(-1, -2);
    const world = buildAiMovePathWorld(start, end);
    const ringPos = { x: world[world.length - 1]!.x + 0.02, z: world[world.length - 1]!.z - 0.01 };
    const patched = applyRingLandingToPathWorld(world, ringPos);
    expect(patched[patched.length - 1]).toEqual(ringPos);
    expect(patched.length).toBe(world.length);
  });

  it('ring piece id matches landing coord for snapshot lookup', () => {
    const end = coordNew(2, -1);
    expect(ringPieceId('B', end)).toBe('ring-B-2,-1');
    const board = Board.empty();
    board.addRing('B', end);
    expect([...board.ringCoords('B')].some(c => c.x === 2 && c.y === -1)).toBe(true);
  });
});
