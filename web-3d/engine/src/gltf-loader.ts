import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { getActiveLoadingScreen, trackIfLoading } from './ui/loading-screen';

let meshoptReady: Promise<void> | undefined;
let meshoptTrackedForScreen = false;

/** Await once before loading meshopt-compressed GLBs (EXT_meshopt_compression). */
export function ensureMeshoptDecoderReady(): Promise<void> {
  if (!meshoptReady) meshoptReady = MeshoptDecoder.ready;
  const screen = getActiveLoadingScreen();
  if (screen && !meshoptTrackedForScreen) {
    meshoptTrackedForScreen = true;
    return screen.track(meshoptReady, 'Loading meshopt decoder (WASM)');
  }
  return meshoptReady;
}

/** GLTFLoader with {@link MeshoptDecoder} wired for compressed game assets. */
export function createMeshoptGltfLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

function gltfLoadLabel(url: string): string {
  const file = url.split('/').pop()?.split('?')[0] ?? url;
  return `Loading GLB ${file}`;
}

export async function loadGltfAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<GLTF> {
  await ensureMeshoptDecoderReady();
  const loader = createMeshoptGltfLoader();
  const load = loader.loadAsync(url, onProgress);
  return trackIfLoading(load, gltfLoadLabel(url));
}
