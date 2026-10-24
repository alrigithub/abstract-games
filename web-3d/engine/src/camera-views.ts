import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ANIMATION, CAMERA } from './constants';

/** Preset camera angles cycled by the shared Camera button. */
export type CameraPresetId = 'top' | 'axo';

export const CAMERA_VIEW = {
  TRANSITION_MS: 400,
  /** Extra margin on fit-to-bounds (matches board framing). */
  PADDING: CAMERA.framePadding,
  /** Tak studio default: 45° around Y. */
  AXO_AZIMUTH: Math.PI / 4,
  /** ~35° above the horizon (same feel as {@link CAMERA.position}). */
  AXO_ELEVATION: (35 * Math.PI) / 180,
  /** Polar angle from +Y for axo (π/2 − elevation). */
  get AXO_POLAR() {
    return Math.PI / 2 - this.AXO_ELEVATION;
  },
  /** Nearly straight down; OrbitControls allows {@link CAMERA.minPolarAngle}. */
  TOP_POLAR: 0.08,
  ORBIT_DISTANCE: 16,
} as const;

export const INITIAL_CAMERA_PRESET: CameraPresetId = 'axo';

/** Next preset after each Camera button press (default load is axo → first press is top). */
export function nextCameraPresetAfter(current: CameraPresetId): CameraPresetId {
  return current === 'top' ? 'axo' : 'top';
}

export interface CameraPose {
  position: THREE.Vector3;
  up: THREE.Vector3;
}

/** World position and up vector for a preset orbiting `target`. */
export function cameraPoseForPreset(
  target: THREE.Vector3,
  preset: CameraPresetId,
  distance: number = CAMERA_VIEW.ORBIT_DISTANCE,
): CameraPose {
  const polar = preset === 'top' ? CAMERA_VIEW.TOP_POLAR : CAMERA_VIEW.AXO_POLAR;
  const azimuth = preset === 'top' ? 0 : CAMERA_VIEW.AXO_AZIMUTH;
  const sinP = Math.sin(polar);
  const cosP = Math.cos(polar);
  const position = new THREE.Vector3(
    target.x + distance * sinP * Math.sin(azimuth),
    target.y + distance * cosP,
    target.z + distance * sinP * Math.cos(azimuth),
  );
  const up = preset === 'top' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  return { position, up };
}

/**
 * Fit an orthographic frustum so all `worldPoints` are visible for the current
 * camera pose (uses {@link THREE.OrthographicCamera.matrixWorldInverse}).
 */
export function fitOrthographicToWorldPoints(
  camera: THREE.OrthographicCamera,
  worldPoints: readonly THREE.Vector3[],
  aspect: number,
  padding: number = CAMERA_VIEW.PADDING,
): void {
  if (!worldPoints.length || aspect <= 0) return;
  camera.updateMatrixWorld(true);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const local = new THREE.Vector3();
  for (const point of worldPoints) {
    local.copy(point).applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, local.x);
    maxX = Math.max(maxX, local.x);
    minY = Math.min(minY, local.y);
    maxY = Math.max(maxY, local.y);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect)) * padding;
  camera.left = centerX - halfHeight * aspect;
  camera.right = centerX + halfHeight * aspect;
  camera.top = centerY + halfHeight;
  camera.bottom = centerY - halfHeight;
  camera.updateProjectionMatrix();
}

export interface CameraViewController {
  readonly preset: CameraPresetId;
  toggle(): void;
  /** Re-fit the current preset after resize or board layout change. */
  refit(): void;
  dispose(): void;
}

export interface CreateCameraViewControllerOptions {
  camera: THREE.OrthographicCamera;
  controls: OrbitControls;
  getBounds: () => THREE.Vector3[];
  getAspect: () => number;
  onUpdate?: () => void;
  transitionMs?: number;
  /** When true (default), snap to {@link INITIAL_CAMERA_PRESET} on create. */
  applyInitial?: boolean;
}

export function createCameraViewController(options: CreateCameraViewControllerOptions): CameraViewController {
  const { camera, controls } = options;
  const transitionMs = options.transitionMs ?? CAMERA_VIEW.TRANSITION_MS;
  let preset: CameraPresetId = INITIAL_CAMERA_PRESET;
  let animFrame = 0;

  const applyPreset = (next: CameraPresetId, animate: boolean) => {
    cancelAnimationFrame(animFrame);
    const target = controls.target.clone();
    const pose = cameraPoseForPreset(target, next);
    const bounds = options.getBounds();
    const aspect = options.getAspect();

    const finish = () => {
      camera.position.copy(pose.position);
      camera.up.copy(pose.up);
      camera.lookAt(target);
      controls.update();
      fitOrthographicToWorldPoints(camera, bounds, aspect);
      options.onUpdate?.();
    };

    if (!animate || transitionMs <= 0) {
      preset = next;
      finish();
      return;
    }

    const fromPos = camera.position.clone();
    const fromUp = camera.up.clone();
    const started = performance.now();

    const tick = (now: number) => {
      const t = ANIMATION.easeOutCubic(Math.min(1, (now - started) / transitionMs));
      camera.position.lerpVectors(fromPos, pose.position, t);
      camera.up.copy(fromUp).lerp(pose.up, t).normalize();
      camera.lookAt(target);
      controls.update();
      fitOrthographicToWorldPoints(camera, options.getBounds(), options.getAspect());
      options.onUpdate?.();
      if (t < 1) animFrame = requestAnimationFrame(tick);
      else {
        preset = next;
        finish();
      }
    };
    animFrame = requestAnimationFrame(tick);
  };

  const refit = () => {
    fitOrthographicToWorldPoints(camera, options.getBounds(), options.getAspect());
    options.onUpdate?.();
  };

  if (options.applyInitial !== false) applyPreset(INITIAL_CAMERA_PRESET, false);

  return {
    get preset() {
      return preset;
    },
    toggle() {
      applyPreset(nextCameraPresetAfter(preset), true);
    },
    refit,
    dispose() {
      cancelAnimationFrame(animFrame);
    },
  };
}
