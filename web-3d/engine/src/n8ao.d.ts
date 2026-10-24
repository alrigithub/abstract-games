declare module 'n8ao' {
  import type * as THREE from 'three';
  import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

  export class N8AOPass extends Pass {
    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number);
    configuration: {
      halfRes: boolean;
      intensity: number;
      aoRadius: number;
      distanceFalloff: number;
      gammaCorrection: boolean;
    };
    setQualityMode(mode: string): void;
    setSize(width: number, height: number): void;
  }
}
