import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tagArenaGlbForShadows } from './board-arena-glb';
import { tagExcludeFromBounds } from './playfield-bounds';

export interface PrerenderedArena {
  light: THREE.Texture;
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

/**
 * Zoom limits for a locked plate.
 * Min pulls back slightly while the board stays centered.
 * Max keeps about 0.72 plate texels per CSS pixel on a 1440px-wide 16:10 view,
 * using how much of the plate that view actually shows.
 */
export function lockedPlateZoomLimits(
  plateEdgePx: number,
  camera?: PrerenderedArena['camera'],
): { min: number; max: number } {
  const referenceCss = 1440;
  const minTexelRatio = 0.72;
  const aspect = 1.6;
  const frameW = camera?.frameWidth ?? camera?.width ?? 1;
  const frameH = camera?.frameHeight ?? camera?.height ?? 1;
  const plateW = camera?.width ?? frameW;
  const halfH = Math.max(frameH / 2, frameW / (2 * aspect));
  const coverage = camera ? Math.min(1, (halfH * 2 * aspect) / plateW) : 1;
  const max = (Math.max(1, plateEdgePx) * coverage) / (referenceCss * minTexelRatio);
  return { min: 0.85, max: Math.min(2, Math.max(1.25, max)) };
}

export function plateTextureEdge(texture: THREE.Texture): number {
  const image = texture.image as { width?: number } | undefined;
  return image?.width && image.width > 0 ? image.width : 1536;
}

/** Contain the authored camera rectangle without cropping or stretching on resize. */
export function fitPrerenderedCamera(
  camera: THREE.OrthographicCamera,
  spec: PrerenderedArena['camera'],
  aspect: number,
  zoom = 1,
): void {
  camera.position.set(spec.position[0]!, spec.position[1]!, spec.position[2]!);
  camera.up.set(0, 1, 0);
  camera.lookAt(spec.target[0]!, spec.target[1]!, spec.target[2]!);
  camera.zoom = zoom;
  const halfHeight = Math.max((spec.frameHeight ?? spec.height) / 2, (spec.frameWidth ?? spec.width) / (2 * aspect));
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

export function createPrerenderedArena(scene: THREE.Scene, spec: PrerenderedArena) {
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
  let map = material.map;
  const textures = new Set<THREE.Texture>();
  function setTexture(texture: THREE.Texture) {
    textures.add(texture);
    map = texture;
    material.map = texture;
    material.needsUpdate = true;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    const image = texture.image as HTMLImageElement | undefined;
    // Use each plate's corner for seamless letterboxing after a preset change.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx && image) {
      ctx.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      scene.background = new THREE.Color().setRGB(pixel[0]! / 255, pixel[1]! / 255, pixel[2]! / 255, THREE.SRGBColorSpace);
    }
  }
  setTexture(spec.light);
  function cover(camera: THREE.OrthographicCamera) {
    const zoom = camera.zoom || 1;
    const visibleW = (camera.right - camera.left) / zoom;
    const visibleH = (camera.top - camera.bottom) / zoom;
    const coverW = Math.max(spec.camera.width, visibleW * 1.02);
    const coverH = Math.max(spec.camera.height, visibleH * 1.02);
    plate.scale.set(coverW / spec.camera.width, coverH / spec.camera.height, 1);
    if (!map) return;
    // Expand UV coverage with the plane so the authored image keeps its world
    // size; ClampToEdge fills the added margins without stretching the arena.
    map.repeat.set(coverW / spec.camera.width, coverH / spec.camera.height);
    map.offset.set((1 - map.repeat.x) / 2, (1 - map.repeat.y) / 2);
  }

  return {
    setTexture,
    cover,
    dispose() {
      scene.remove(plate);
      geometry.dispose();
      material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}

/** Collapse authored column meshes that do not share UV layouts. Positions stay put. */
export function batchAuthoredMeshes(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const parts: THREE.BufferGeometry[] = [];
  const meshes: THREE.Mesh[] = [];
  let material: THREE.Material | undefined;
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (Array.isArray(node.material)) throw new Error('Expected one shared material on baked-arena columns');
    material ??= node.material;
    meshes.push(node);
    let geometry = node.geometry.clone();
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    if (geometry.index) {
      const indexed = geometry;
      geometry = indexed.toNonIndexed();
      indexed.dispose();
    }
    parts.push(geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld)));
  });
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged || !material) throw new Error('Missing live arena meshes');
  if (root instanceof THREE.Group) root.clear();
  else for (const mesh of meshes) mesh.parent?.remove(mesh);
  root.add(new THREE.Mesh(merged, material));
}

/** Invisible depth plus a shadow receiver, one quad per registered cell. */
export function createPrerenderTileProxies(
  cells: readonly { x: number; y: number; z: number }[],
  tile = 0.94,
): { depth: THREE.Mesh; shadow: THREE.Mesh } {
  const parts = cells.map(cell => {
    const geometry = new THREE.PlaneGeometry(tile, tile);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(cell.x, cell.y, cell.z);
    return geometry;
  });
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error('Could not create prerender tile proxies');
  const depth = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false }));
  depth.name = 'prerender-tile-depth-proxy';
  depth.renderOrder = -1;
  const shadow = new THREE.Mesh(geometry, new THREE.ShadowMaterial({ opacity: 0.22, depthWrite: false }));
  shadow.name = 'prerender-tile-shadow-receiver';
  shadow.position.y = 0.001;
  tagArenaGlbForShadows(shadow);
  shadow.castShadow = false;
  return { depth, shadow };
}

export interface LockedPlateZoom {
  /** Zoom currently applied to the camera, including in-progress easing. */
  zoom(): number;
  dispose(): void;
}

/**
 * Wheel, trackpad pinch, and two-finger pinch. Orbit and pan stay locked.
 * Zoom is `OrthographicCamera.zoom`, so the plate mesh and the live geometry scale together.
 */
export function attachLockedPlateZoom(options: {
  camera: THREE.OrthographicCamera;
  domElement: HTMLElement;
  minZoom: number;
  maxZoom: number;
  onChange: () => void;
}): LockedPlateZoom {
  let target = options.camera.zoom;
  let current = target;
  let frame = 0;
  let lastTime = performance.now();
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchStartDist = 0;
  let pinchStartTarget = target;

  function clamp(zoom: number) {
    return Math.min(options.maxZoom, Math.max(options.minZoom, zoom));
  }

  function tick(now: number) {
    frame = 0;
    const dt = Math.min(48, now - lastTime);
    lastTime = now;
    current += (target - current) * (1 - Math.exp(-dt / 110));
    if (Math.abs(target - current) < 0.0004) current = target;
    options.camera.zoom = current;
    options.camera.updateProjectionMatrix();
    options.onChange();
    if (current !== target) frame = requestAnimationFrame(tick);
  }

  function nudge() {
    if (frame) return;
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const pixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.deltaY * 120
        : event.deltaY;
    const speed = event.ctrlKey ? 0.01 : 0.0016;
    target = clamp(target * Math.exp(-pixels * speed));
    nudge();
  }

  function pinchDistance() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a!.x - b!.x, a!.y - b!.y);
  }

  function setPinch(active: boolean) {
    if (active) {
      options.domElement.dataset.cameraGesture = 'true';
      options.domElement.dispatchEvent(new CustomEvent('camera-gesture', { detail: { active: true } }));
      return;
    }
    if (options.domElement.dataset.cameraGesture) {
      delete options.domElement.dataset.cameraGesture;
      options.domElement.dispatchEvent(new CustomEvent('camera-gesture', { detail: { active: false } }));
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      pinchStartDist = pinchDistance();
      pinchStartTarget = target;
      setPinch(true);
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size !== 2 || pinchStartDist <= 0) return;
    event.preventDefault();
    target = clamp(pinchStartTarget * (pinchDistance() / pinchStartDist));
    nudge();
  }

  function onPointerEnd(event: PointerEvent) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinchStartDist = 0;
      setPinch(false);
    }
  }

  options.domElement.addEventListener('wheel', onWheel, { passive: false });
  options.domElement.addEventListener('pointerdown', onPointerDown);
  options.domElement.addEventListener('pointermove', onPointerMove);
  options.domElement.addEventListener('pointerup', onPointerEnd);
  options.domElement.addEventListener('pointercancel', onPointerEnd);

  return {
    zoom: () => current,
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      options.domElement.removeEventListener('wheel', onWheel);
      options.domElement.removeEventListener('pointerdown', onPointerDown);
      options.domElement.removeEventListener('pointermove', onPointerMove);
      options.domElement.removeEventListener('pointerup', onPointerEnd);
      options.domElement.removeEventListener('pointercancel', onPointerEnd);
      setPinch(false);
    },
  };
}
