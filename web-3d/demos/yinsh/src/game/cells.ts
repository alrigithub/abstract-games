import { YINSH_COORDS, yinshIndex, type YinshCoord } from '@abstract/three-engine';
import type { Coord } from './coord';

export function indexToCoord(index: number): Coord {
  const c = YINSH_COORDS[index];
  if (!c) throw new Error(`invalid cell ${index}`);
  return { x: c.x, y: c.y };
}

export function coordToIndex(coord: Coord): number {
  return yinshIndex(coord as YinshCoord);
}
