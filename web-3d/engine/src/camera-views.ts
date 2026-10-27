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
  setPreset(preset: CameraPresetId, animate?: boolean): void;
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

interface OrbitSnapshot {
  target: THREE.Vector3;
  theta: number;
  phi: number;
  radius: number;
  zoom: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  up: THREE.Vector3;
}

export function createCameraViewController(options: CreateCameraViewControllerOptions): CameraViewController {
  const { camera, controls } = options;
  const transitionMs = options.transitionMs ?? CAMERA_VIEW.TRANSITION_MS;
  /** Board-centre orbit pivot. Captured before any preset moves the target. */
  const boardCenter = controls.target.clone();
  const baseMinPolar = controls.minPolarAngle ?? 0;
  let preset: CameraPresetId = INITIAL_CAMERA_PRESET;
  let animFrame = 0;
  let animating = false;
  let pinning = false;
  /** Angled orbit saved on the way into top view, restored exactly on the way out. */
  let savedAngled: OrbitSnapshot | null = null;

  const offset = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  const fromPos = new THREE.Vector3();
  const toPos = new THREE.Vector3();
  const fromUp = new THREE.Vector3();
  const toUp = new THREE.Vector3();
  const fromTarget = new THREE.Vector3();
  const toTarget = new THREE.Vector3();

  const captureOrbit = (): OrbitSnapshot => {
    offset.copy(camera.position).sub(controls.target);
    spherical.setFromVector3(offset);
    return {
      target: controls.target.clone(),
      theta: spherical.theta,
      phi: spherical.phi,
      radius: spherical.radius,
      zoom: camera.zoom,
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
      up: camera.up.clone(),
    };
  };

  const applyOrbit = (state: OrbitSnapshot, target: THREE.Vector3) => {
    offset.setFromSphericalCoords(state.radius, state.phi, state.theta);
    controls.target.copy(target);
    camera.position.copy(target).add(offset);
    camera.up.copy(state.up);
    camera.zoom = state.zoom;
    camera.left = state.left;
    camera.right = state.right;
    camera.top = state.top;
    camera.bottom = state.bottom;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
  };

  const setMinPolar = (value: number) => {
    if (typeof controls.minPolarAngle === 'number') controls.minPolarAngle = value;
  };

  const pinTopTarget = () => {
    if (animating || pinning || preset !== 'top') return;
    if (controls.target.distanceToSquared(boardCenter) < 1e-12) return;
    pinning = true;
    camera.position.add(boardCenter).sub(controls.target);
    controls.target.copy(boardCenter);
    controls.update();
    pinning = false;
  };

  const onControlsChange = () => {
    pinTopTarget();
  };
  controls.addEventListener?.('change', onControlsChange);

  const stopAnimation = () => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(animFrame);
    animFrame = 0;
    animating = false;
  };

  /**
   * Ease camera pose. `controls.update` runs only at the end so the polar clamp
   * cannot rewrite the orbit halfway through the move.
   */
  const fromFrustum = { left: 0, right: 0, top: 0, bottom: 0 };
  const toFrustum = { left: 0, right: 0, top: 0, bottom: 0 };
  let lerpFrustum = false;
  let fromZoom = 1;
  let toZoom = 1;

  const easeTo = (animate: boolean, finish: () => void) => {
    stopAnimation();
    if (!animate || transitionMs <= 0) {
      finish();
      return;
    }
    animating = true;
    const started = performance.now();
    const tick = (now: number) => {
      const t = ANIMATION.easeOutCubic(Math.min(1, (now - started) / transitionMs));
      camera.position.lerpVectors(fromPos, toPos, t);
      camera.up.copy(fromUp).lerp(toUp, t).normalize();
      controls.target.lerpVectors(fromTarget, toTarget, t);
      camera.lookAt(controls.target);
      if (lerpFrustum) {
        camera.zoom = fromZoom + (toZoom - fromZoom) * t;
        camera.left = fromFrustum.left + (toFrustum.left - fromFrustum.left) * t;
        camera.right = fromFrustum.right + (toFrustum.right - fromFrustum.right) * t;
        camera.top = fromFrustum.top + (toFrustum.top - fromFrustum.top) * t;
        camera.bottom = fromFrustum.bottom + (toFrustum.bottom - fromFrustum.bottom) * t;
        camera.updateProjectionMatrix();
      } else {
        fitOrthographicToWorldPoints(camera, options.getBounds(), options.getAspect());
      }
      options.onUpdate?.();
      if (t < 1) {
        animFrame = requestAnimationFrame(tick);
        return;
      }
      animating = false;
      animFrame = 0;
      finish();
    };
    animFrame = requestAnimationFrame(tick);
  };

  const finishTop = () => {
    const pose = cameraPoseForPreset(boardCenter, 'top');
    setMinPolar(Math.min(baseMinPolar, CAMERA_VIEW.TOP_POLAR));
    controls.target.copy(boardCenter);
    camera.position.copy(pose.position);
    camera.up.copy(pose.up);
    camera.lookAt(boardCenter);
    controls.update();
    pinTopTarget();
    fitOrthographicToWorldPoints(camera, options.getBounds(), options.getAspect());
    options.onUpdate?.();
  };

  const finishAngled = (snapshot: OrbitSnapshot) => {
    setMinPolar(baseMinPolar);
    applyOrbit(snapshot, snapshot.target);
    controls.update();
    // update() can clamp a near-pole angle. Put the saved orbit back so the
    // next drag reads this pose instead of the top-view spherical state.
    applyOrbit(snapshot, snapshot.target);
    options.onUpdate?.();
  };

  const goTop = (animate: boolean) => {
    if (!savedAngled) savedAngled = captureOrbit();
    preset = 'top';
    lerpFrustum = false;
    const pose = cameraPoseForPreset(boardCenter, 'top');
    fromPos.copy(camera.position);
    toPos.copy(pose.position);
    fromUp.copy(camera.up);
    toUp.copy(pose.up);
    fromTarget.copy(controls.target);
    toTarget.copy(boardCenter);
    easeTo(animate, finishTop);
  };

  const goAngled = (animate: boolean) => {
    preset = 'axo';
    const snapshot = savedAngled;
    if (!snapshot) {
      lerpFrustum = false;
      const pose = cameraPoseForPreset(controls.target, 'axo');
      fromPos.copy(camera.position);
      toPos.copy(pose.position);
      fromUp.copy(camera.up);
      toUp.copy(pose.up);
      fromTarget.copy(controls.target);
      toTarget.copy(controls.target);
      easeTo(animate, () => {
        camera.position.copy(pose.position);
        camera.up.copy(pose.up);
        camera.lookAt(controls.target);
        controls.update();
        fitOrthographicToWorldPoints(camera, options.getBounds(), options.getAspect());
        options.onUpdate?.();
      });
      return;
    }
    lerpFrustum = true;
    fromZoom = camera.zoom;
    toZoom = snapshot.zoom;
    fromFrustum.left = camera.left;
    fromFrustum.right = camera.right;
    fromFrustum.top = camera.top;
    fromFrustum.bottom = camera.bottom;
    toFrustum.left = snapshot.left;
    toFrustum.right = snapshot.right;
    toFrustum.top = snapshot.top;
    toFrustum.bottom = snapshot.bottom;
    fromPos.copy(camera.position);
    offset.setFromSphericalCoords(snapshot.radius, snapshot.phi, snapshot.theta);
    toPos.copy(snapshot.target).add(offset);
    fromUp.copy(camera.up);
    toUp.copy(snapshot.up);
    fromTarget.copy(controls.target);
    toTarget.copy(snapshot.target);
    easeTo(animate, () => {
      finishAngled(snapshot);
      savedAngled = null;
    });
  };

  const applyPreset = (next: CameraPresetId, animate: boolean) => {
    if (next === 'top') goTop(animate);
    else goAngled(animate);
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
    setPreset(next: CameraPresetId, animate = false) {
      applyPreset(next, animate);
    },
    refit,
    dispose() {
      stopAnimation();
      controls.removeEventListener?.('change', onControlsChange);
    },
  };
}
