/// <reference path="./n8ao.d.ts" />
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { N8AOPass } from 'n8ao';
import { CLAY } from './constants';

export interface BoardRenderPipeline {
  render(): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

export type BoardRenderPipelineOptions = {
  /** Override URL / default AO enable (used in tests). */
  aoEnabled?: boolean;
};

function readClayAoDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has('noao');
  } catch {
    return false;
  }
}

/**
 * Shared beauty pass + optional N8AO for the clay look. Games call {@link BoardRenderPipeline.render}
 * instead of `renderer.render` directly.
 */
export function createBoardRenderPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: BoardRenderPipelineOptions = {},
): BoardRenderPipeline {
  const aoEnabled = options.aoEnabled ?? (CLAY.AO_ENABLED && !readClayAoDisabled());

  if (!aoEnabled) {
    return {
      render() {
        renderer.render(scene, camera);
      },
      setSize(width, height) {
        renderer.setSize(width, height, false);
      },
      dispose() {},
    };
  }

  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  const aoPass = new N8AOPass(scene, camera, Math.max(1, size.x), Math.max(1, size.y));
  aoPass.setQualityMode(CLAY.AO_QUALITY);
  aoPass.configuration.halfRes = CLAY.AO_HALF_RES;
  aoPass.configuration.intensity = CLAY.AO_INTENSITY;
  aoPass.configuration.aoRadius = CLAY.AO_RADIUS;
  aoPass.configuration.distanceFalloff = CLAY.AO_DISTANCE_FALLOFF;
  aoPass.configuration.gammaCorrection = false;
  composer.addPass(aoPass);
  // Canvas MSAA cannot smooth N8AO's offscreen beauty target. SMAA operates
  // in linear space in r180; OutputPass then applies AgX and sRGB exactly once.
  const antialiasPass = new SMAAPass();
  const outputPass = new OutputPass();
  composer.addPass(antialiasPass);
  composer.addPass(outputPass);

  return {
    render() {
      composer.render();
    },
    setSize(width, height) {
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
    },
    dispose() {
      aoPass.dispose();
      antialiasPass.dispose();
      outputPass.dispose();
      composer.dispose();
    },
  };
}
