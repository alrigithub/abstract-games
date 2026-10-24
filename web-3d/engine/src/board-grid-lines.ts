import * as THREE from 'three';
import { BOARD } from './constants';

/** Target grid line width in screen pixels (constant across orthographic zoom). */
export const BOARD_GRID_LINE_PX = 1.05;

/** Width baked into line geometry; screen scale compensates for zoom. */
export const BOARD_GRID_LINE_BASE_W = BOARD.LINE_W;

export function orthoWorldUnitsPerPixel(camera: THREE.OrthographicCamera, viewportHeightPx: number): number {
  const h = Math.max(1, viewportHeightPx);
  return (camera.top - camera.bottom) / (h * camera.zoom);
}

export function boardGridLineWorldWidth(camera: THREE.OrthographicCamera, viewportHeightPx: number): number {
  return BOARD_GRID_LINE_PX * orthoWorldUnitsPerPixel(camera, viewportHeightPx);
}

export function boardGridLineScreenScale(camera: THREE.OrthographicCamera, viewportHeightPx: number): number {
  return boardGridLineWorldWidth(camera, viewportHeightPx) / BOARD_GRID_LINE_BASE_W;
}

export function tagBoardGridLine(object: THREE.Object3D): void {
  object.userData.boardGridLine = true;
}

/** Scale tagged line meshes so world width tracks {@link BOARD_GRID_LINE_PX}. */
export function applyBoardGridLineScreenScale(root: THREE.Object3D, scale: number): void {
  root.traverse(obj => {
    if (obj.userData.boardGridLine) obj.scale.set(scale, 1, scale);
  });
}
