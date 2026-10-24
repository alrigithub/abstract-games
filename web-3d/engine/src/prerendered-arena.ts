import * as THREE from 'three';
import type { ThemeId } from './theme';
import { tagExcludeFromBounds } from './playfield-bounds';

export interface PrerenderedArena {
  light: THREE.Texture;
  dark: THREE.Texture;
  occluders?: THREE.Object3D;
  camera: {
    position: readonly number[];
    target: readonly number[];
    width: number;
    height: number;
    frameWidth?: number;
    frameHeight?: number;
  };
}

/** Contain the authored camera rectangle without cropping or stretching on resize. */
export function fitPrerenderedCamera(camera: THREE.OrthographicCamera, spec: PrerenderedArena['camera'], aspect: number): void {
  camera.position.set(spec.position[0]!, spec.position[1]!, spec.position[2]!);
  camera.up.set(0, 1, 0);
  camera.lookAt(spec.target[0]!, spec.target[1]!, spec.target[2]!);
  camera.zoom = 1;
  const halfHeight = Math.max((spec.frameHeight ?? spec.height) / 2, (spec.frameWidth ?? spec.width) / (2 * aspect));
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

export function createPrerenderedArena(scene: THREE.Scene, spec: PrerenderedArena, theme: ThemeId) {
  const direction = new THREE.Vector3(...spec.camera.position).sub(new THREE.Vector3(...spec.camera.target)).normalize();
  const material = new THREE.MeshBasicMaterial({ map: spec.light, toneMapped: false, fog: false, depthWrite: false });
  const geometry = new THREE.PlaneGeometry(spec.camera.width, spec.camera.height);
  const plate = new THREE.Mesh(geometry, material);
  plate.name = 'pre-rendered-static-arena';
  plate.position.set(spec.camera.target[0]!, spec.camera.target[1]!, spec.camera.target[2]!).addScaledVector(direction, -30);
  plate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  // Match the camera's up vector; shortest-arc rotation alone can roll the image.
  const orientation = new THREE.Matrix4().lookAt(new THREE.Vector3(...spec.camera.position), new THREE.Vector3(...spec.camera.target), new THREE.Vector3(0, 1, 0));
  plate.quaternion.setFromRotationMatrix(orientation);
  plate.renderOrder = -10;
  tagExcludeFromBounds(plate);
  scene.add(plate);
  function setTheme(id: ThemeId) {
    material.map = id === 'light' ? spec.light : spec.dark;
    spec.occluders?.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
        if (mat.userData.plateLightColor === undefined) mat.userData.plateLightColor = mat.color.getHex();
        mat.color.setHex(id === 'light' ? mat.userData.plateLightColor : 0x72716e);
      }
    });
    const image = material.map.image as HTMLImageElement;
    // Use the plate's own corner for seamless letterboxing, including Blender lighting.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx && image) {
      ctx.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      scene.background = new THREE.Color().setRGB(pixel[0]! / 255, pixel[1]! / 255, pixel[2]! / 255, THREE.SRGBColorSpace);
    }
  }
  setTheme(theme);
  return { setTheme, dispose() { scene.remove(plate); geometry.dispose(); material.dispose(); spec.light.dispose(); spec.dark.dispose(); } };
}
