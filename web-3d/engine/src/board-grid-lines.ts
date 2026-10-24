import * as THREE from 'three';
import { BOARD } from './constants';

/** Target grid line width in screen pixels (constant across orthographic zoom). */
export const BOARD_GRID_LINE_PX = 1.05;

/** Width baked into line geometry; screen scale compensates for zoom. */
export const BOARD_GRID_LINE_BASE_W = BOARD.LINE_W;

export type BoardGridLineThicknessAxis = 'x' | 'z';

export interface TagBoardGridLineOptions {
  /** World axis that carries line thickness (length stays on the other axis). */
  thicknessAxis?: BoardGridLineThicknessAxis;
  /** Merged / rotated line meshes cannot use axis screen scale — keep geometry width only. */
  screenScale?: boolean;
}

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

export function tagBoardGridLine(object: THREE.Object3D, options: TagBoardGridLineOptions = {}): void {
  object.userData.boardGridLine = true;
  if (options.thicknessAxis) object.userData.boardGridLineThickness = options.thicknessAxis;
  if (options.screenScale === false) object.userData.boardGridLineScreenScale = false;
}

/**
 * Scale tagged line meshes so world thickness tracks {@link BOARD_GRID_LINE_PX}.
 * Lines use {@link THREE.PlaneGeometry} on XY then `rotation.x = -π/2`, so world X ↔ local X
 * and world Z ↔ local Y (not local Z — that is the plane normal).
 */
export function applyBoardGridLineScreenScale(root: THREE.Object3D, scale: number): void {
  root.traverse(obj => {
    if (!obj.userData.boardGridLine) return;
    if (obj.userData.boardGridLineScreenScale === false) {
      obj.scale.set(1, 1, 1);
      return;
    }
    const thickness = obj.userData.boardGridLineThickness as BoardGridLineThicknessAxis | undefined;
    if (thickness === 'x') obj.scale.set(scale, 1, 1);
    else if (thickness === 'z') obj.scale.set(1, scale, 1);
    else obj.scale.set(scale, 1, scale);
  });
}
