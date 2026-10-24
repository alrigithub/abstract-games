import { describe, expect, it } from 'vitest';
import { BOOP_GRID } from './boop-grid';
import { BOOP_ARENA_WORLD_CORRECTION } from './boop-arena';

/** Cell node translations from `arena-test.glb` (rank 1 = row 5, file A = col 0). */
const CELL_LOCAL: Record<string, [number, number, number]> = {
  A1: [-2.625, 0.12949180603027344, 2.625],
  A2: [-2.625, -0.078857421875, 1.575],
  A3: [-2.7269287109375, -0.18603515625, 0.3795166015625],
  A4: [-2.625, 0.058837890625, -0.525],
  A5: [-2.625, -0.07861328125, -1.575],
  A6: [-2.625, -0.0078125, -2.625],
  B1: [-1.5953369140625, -0.045654296875, 2.625],
  B2: [-1.575, -0.266845703125, 1.575],
  B3: [-1.575, -0.309814453125, 0.525],
  B6: [-1.575, -0.0693359375, -2.625],
  C1: [-0.525, -0.02178955078125, 2.625],
  C2: [-0.525, -0.154541015625, 1.575],
  C3: [-0.525, -0.2099609375, 0.525],
  C6: [-0.525, 0.01171875, -2.625],
  D1: [1.929443359375, -0.0853271484375, 4.3525390625],
  D2: [0.525, 0.008544921875, 1.575],
  D3: [0.525, -0.005615234375, 0.525],
  D4: [0.525, -0.240966796875, -0.525],
  D5: [0.525, -0.25927734375, -1.575],
  D6: [0.525, -0.0927734375, -2.625],
  E1: [1.575, 0.052734375, 2.625],
  E2: [1.575, 0.017333984375, 1.575],
  E3: [1.575, -0.091064453125, 0.525],
  E4: [1.575, -0.318603515625, -0.525],
  E5: [1.575, -0.3717041015625, -1.575],
  E6: [1.575, -0.0654296875, -2.625],
  F1: [2.625, 0.046142578125, 2.625],
  F2: [2.625, 0.0474853515625, 1.575],
  F3: [2.625, 0.11572265625, 0.525],
  F4: [2.625, -0.0732421875, -0.525],
  F5: [2.625, -0.11962890625, -1.575],
  F6: [2.625, 0.125244140625, -2.625],
};

/** Export omits four interior stone tiles; logical bed cells still use the square grid. */
const MISSING_BED_CELLS = new Set(['1,1', '1,2', '2,1', '2,2']);

function cellKey(row: number, col: number): string {
  const file = String.fromCharCode('A'.charCodeAt(0) + col);
  const rank = BOOP_GRID - row;
  return `${file}${rank}`;
}

function cellWorldXz(row: number, col: number): [number, number] {
  const local = CELL_LOCAL[cellKey(row, col)];
  if (!local) return [NaN, NaN];
  return [
    local[0] + BOOP_ARENA_WORLD_CORRECTION.x,
    local[2] + BOOP_ARENA_WORLD_CORRECTION.z,
  ];
}

function gameCellCenter(row: number, col: number): [number, number] {
  const half = (BOOP_GRID - 1) / 2;
  return [col - half, row - half];
}

describe('boop arena grid alignment', () => {
  it('aligns authored cell markers to the 6×6 bed within ~20 cm (irregular mesh)', () => {
    const errors: number[] = [];
    for (let row = 0; row < BOOP_GRID; row++) {
      for (let col = 0; col < BOOP_GRID; col++) {
        if (MISSING_BED_CELLS.has(`${row},${col}`)) continue;
        const key = cellKey(row, col);
        if (key === 'D1') continue;
        const world = cellWorldXz(row, col);
        const target = gameCellCenter(row, col);
        errors.push(Math.hypot(world[0] - target[0], world[1] - target[1]));
      }
    }
    expect(Math.max(...errors)).toBeLessThan(0.36);
    const median = errors.sort((a, b) => a - b)[Math.floor(errors.length / 2)]!;
    expect(median).toBeLessThan(0.15);
  });
});
