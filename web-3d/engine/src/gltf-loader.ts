import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

let meshoptReady: Promise<void> | undefined;

/** Await once before loading meshopt-compressed GLBs (EXT_meshopt_compression). */
export function ensureMeshoptDecoderReady(): Promise<void> {
  if (!meshoptReady) meshoptReady = MeshoptDecoder.ready;
  return meshoptReady;
}

/** GLTFLoader with {@link MeshoptDecoder} wired for compressed game assets. */
export function createMeshoptGltfLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export async function loadGltfAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<GLTF> {
  await ensureMeshoptDecoderReady();
  const loader = createMeshoptGltfLoader();
  return loader.loadAsync(url, onProgress);
}
