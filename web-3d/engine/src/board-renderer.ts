import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BOARD } from './constants';

/**
 * Shared unlit board rendering: sRGB output, no tone mapping, pixel ratio 1.
 * MeshBasic board/piece materials stay unlit. PBR GLBs use {@link applyBoardEnvironment}.
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
