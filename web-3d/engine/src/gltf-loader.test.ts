import { describe, expect, it } from 'vitest';
import { createMeshoptGltfLoader, ensureMeshoptDecoderReady } from './gltf-loader';

describe('meshopt GLTF loader', () => {
  it('resolves MeshoptDecoder and attaches it to GLTFLoader', async () => {
    await ensureMeshoptDecoderReady();
    const loader = createMeshoptGltfLoader();
    expect(loader).toBeDefined();
    expect(typeof loader.loadAsync).toBe('function');
  });
});
