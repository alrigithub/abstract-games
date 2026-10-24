import { nearestIntersection } from "@abstract/pixi-shared";
import { BOARD_SIZE } from "../engine";

export const CELL = 32;

export function intersectionToWorld(x: number, y: number) {
  return {
    x: (x - (BOARD_SIZE - 1) / 2) * CELL,
    y: (y - (BOARD_SIZE - 1) / 2) * CELL,
  };
}

export function worldToIntersection(wx: number, wy: number) {
  const hit = nearestIntersection(wx, wy, CELL, BOARD_SIZE);
  return hit ? { x: hit.col, y: hit.row } : null;
}
