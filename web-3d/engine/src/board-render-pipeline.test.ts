import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ passes: [] as { kind: string; dispose: () => void }[], resize: vi.fn(), dispose: vi.fn() }));
vi.mock('three/addons/postprocessing/EffectComposer.js', () => ({
  EffectComposer: class {
    constructor() { state.passes = []; }
    addPass(pass: { kind: string; dispose: () => void }) { state.passes.push(pass); }
    setSize = state.resize;
    dispose = state.dispose;
    render = vi.fn();
  },
}));
vi.mock('n8ao', () => ({ N8AOPass: class {
  kind = 'ao'; configuration = {}; setQualityMode = vi.fn(); dispose = vi.fn();
} }));
vi.mock('three/addons/postprocessing/SMAAPass.js', () => ({ SMAAPass: class { kind = 'smaa'; dispose = vi.fn(); } }));
vi.mock('three/addons/postprocessing/OutputPass.js', () => ({ OutputPass: class { kind = 'output'; dispose = vi.fn(); } }));

import { createBoardRenderPipeline } from './board-render-pipeline';

describe('board postprocessing', () => {
  it('smooths linear AO output before a single display conversion, and releases passes', () => {
    const renderer = { getSize: (size: THREE.Vector2) => size.set(800, 600), setSize: vi.fn() };
    const pipeline = createBoardRenderPipeline(renderer as unknown as THREE.WebGLRenderer, new THREE.Scene(), new THREE.Camera(), { aoEnabled: true });
    expect(state.passes.map(pass => pass.kind)).toEqual(['ao', 'smaa', 'output']);
    pipeline.setSize(1200, 900);
    expect(state.resize).toHaveBeenCalledWith(1200, 900);
    pipeline.dispose();
    for (const pass of state.passes) expect(pass.dispose).toHaveBeenCalledOnce();
    expect(state.dispose).toHaveBeenCalledOnce();
  });

  it('retains the native renderer path when AO is disabled', () => {
    const renderer = { render: vi.fn(), setSize: vi.fn() };
    const scene = new THREE.Scene(); const camera = new THREE.Camera();
    const pipeline = createBoardRenderPipeline(renderer as unknown as THREE.WebGLRenderer, scene, camera, { aoEnabled: false });
    pipeline.render();
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
    pipeline.setSize(400, 300);
    expect(renderer.setSize).toHaveBeenCalledWith(400, 300, false);
  });
});
