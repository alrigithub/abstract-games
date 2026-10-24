import { describe, expect, it } from 'vitest';
import { BOOP_GRID } from './boop-grid';
import { BOOP_ARENA_WORLD_CORRECTION } from './boop-arena';

/** Arena Stone node from `overgrown-arena-all-white.glb` (matches Blender export). */
const STONE_NODE_QUAT: [number, number, number, number] = [
  0.004919528961181641, 0.004349056165665388, -0.0029747833032160997, 0.9999741315841675,
];
const STONE_NODE_TRANSLATION: [number, number, number] = [-2.625, 0.12949180603027344, 2.625];

function rotateByQuat(q: readonly [number, number, number, number], v: readonly [number, number, number]) {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy;
  const iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx;
  const iw = -x * vx - y * vy - z * vz;
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ] as const;
}

/** Maps playable cell (row, col) to Arena Stone mesh local XZ (1-unit pitch in world after export). */
function modelLocalXz(row: number, col: number): [number, number] {
  return [col, row - (BOOP_GRID - 1)];
}

function stoneNodeWorldXz(localX: number, localZ: number): [number, number] {
  const rotated = rotateByQuat(STONE_NODE_QUAT, [localX, 0, localZ]);
  return [
    rotated[0] + STONE_NODE_TRANSLATION[0] + BOOP_ARENA_WORLD_CORRECTION.x,
    rotated[2] + STONE_NODE_TRANSLATION[2] + BOOP_ARENA_WORLD_CORRECTION.z,
  ];
}

function gameCellCenter(row: number, col: number): [number, number] {
  const half = (BOOP_GRID - 1) / 2;
  return [col - half, row - half];
}

describe('boop arena grid alignment', () => {
  it('maps every bed cell centre to the stone tile grid within 2 mm', () => {
    for (let row = 0; row < BOOP_GRID; row++) {
      for (let col = 0; col < BOOP_GRID; col++) {
        const [lx, lz] = modelLocalXz(row, col);
        const world = stoneNodeWorldXz(lx, lz);
        const target = gameCellCenter(row, col);
        expect(Math.hypot(world[0] - target[0], world[1] - target[1])).toBeLessThan(0.04);
      }
    }
  });
});
