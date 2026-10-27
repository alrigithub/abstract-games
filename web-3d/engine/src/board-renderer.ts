import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { configureBoardShadowMap } from './board-lighting';
import { BOARD, CAMERA, CLAY } from './constants';

/**
 * Shared board rendering: sRGB output, AgX tone mapping, pixel ratio 1.
 * PBR GLBs use {@link applyBoardEnvironment}; optional N8AO via {@link createBoardRenderPipeline}.
 */
export function createBoardWebGLRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  configureBoardWebGLRenderer(renderer);
  return renderer;
}

/**
 * Drawing-buffer size for the shared board pipeline.
 * Live geometry (Boop `?arena=3d`, Gomoku) uses at least {@link CAMERA.minRenderScale}
 * and {@link CAMERA.maxBufferPixels}. A pre-rendered plate caps DPR at 1.5 and 1.5e6 pixels.
 */
export function boardDrawingBufferSize(
  cssWidth: number,
  cssHeight: number,
  options: { prerendered?: boolean } = {},
): { width: number; height: number } {
  const width = Math.max(1, Math.round(cssWidth));
  const height = Math.max(1, Math.round(cssHeight));
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const pixelBudget = options.prerendered ? 1_500_000 : CAMERA.maxBufferPixels;
  const resolution = options.prerendered ? Math.min(dpr, 1.5) : Math.max(CAMERA.minRenderScale, dpr);
  const renderScale = Math.min(
    resolution,
    CAMERA.maxPixelRatio,
    Math.sqrt(pixelBudget / (width * height)),
  );
  return {
    width: Math.max(1, Math.round(width * renderScale)),
    height: Math.max(1, Math.round(height * renderScale)),
  };
}

export function configureBoardWebGLRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = CLAY.TONE_MAPPING_EXPOSURE;
  configureBoardShadowMap(renderer);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
}

/** Time one full render (ms); for headless perf checks. */
export function measureBoardFrameMs(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderFrame: () => void = () => renderer.render(scene, camera),
): number {
  const t0 = performance.now();
  renderFrame();
  return performance.now() - t0;
}

/**
 * One shared IBL for every game: PMREM {@link RoomEnvironment} on `scene.environment`.
 * Bakes, then disposes the generator and room. Returns a disposer for the env render target.
 */
export function applyBoardEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): () => void {
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(room);
  scene.environment = target.texture;
  scene.environmentIntensity = BOARD.ENVIRONMENT_INTENSITY;
  room.dispose();
  pmrem.dispose();
  return () => {
    if (scene.environment === target.texture) scene.environment = null;
    target.dispose();
  };
}
