import * as THREE from 'three';

/**
 * Shared unlit board rendering: sRGB output, no tone mapping, pixel ratio 1.
 * {@link createBoardScene} and demos use MeshBasic materials only — no scene lights.
 */
export function createBoardWebGLRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  configureBoardWebGLRenderer(renderer);
  return renderer;
}

export function configureBoardWebGLRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
}
