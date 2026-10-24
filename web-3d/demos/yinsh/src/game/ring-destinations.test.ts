import { describe, expect, it } from 'vitest';
import { Board } from './board';
import { coordEq, coordNew } from './coord';
import { isRingDestination, ringDestinationCoords, ringPathCoords } from './ring-destinations';

describe('ring legal destinations', () => {
  it('slides along a line through empty cells and stops before a ring', () => {
    const board = Board.empty();
    board.addRing('A', coordNew(0, 0));
    board.addRing('B', coordNew(0, -4));
    const dests = ringDestinationCoords(board, coordNew(0, 0));
    expect(dests.some(c => coordEq(c, coordNew(0, -1)))).toBe(true);
    expect(dests.some(c => coordEq(c, coordNew(0, -2)))).toBe(true);
    expect(dests.some(c => coordEq(c, coordNew(0, -3)))).toBe(true);
    expect(dests.some(c => coordEq(c, coordNew(0, -4)))).toBe(false);
  });

  it('can jump over a marker run to the next free cell', () => {
    const board = Board.empty();
    board.addRing('A', coordNew(0, 0));
    board.addMarker('B', coordNew(0, -1));
    board.addMarker('B', coordNew(0, -2));
    const dests = ringDestinationCoords(board, coordNew(0, 0));
    expect(dests).toContainEqual(coordNew(0, -3));
    expect(isRingDestination(board, coordNew(0, 0), coordNew(0, -3))).toBe(true);
    expect(isRingDestination(board, coordNew(0, 0), coordNew(0, -1))).toBe(false);
  });

  it('builds an inclusive path for preview', () => {
    const path = ringPathCoords(coordNew(0, 0), coordNew(0, -3));
    expect(path).toEqual([
      coordNew(0, 0),
      coordNew(0, -1),
      coordNew(0, -2),
      coordNew(0, -3),
    ]);
  });
});
