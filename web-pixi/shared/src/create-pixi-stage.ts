import { Application, Container } from "pixi.js";
import {
  applyCameraToContainer,
  applyPan,
  applyZoomAt,
  DEFAULT_CAMERA_LIMITS,
  screenToWorld,
  type CameraState,
} from "./pixi-stage/camera";
import { PIXI_PALETTE } from "./pixi-stage/palette";
import { safeDestroyApplication } from "./pixi-stage/destroy-application";
import {
  isTrackpadPanWheel,
  shouldStartPanOnPointerDown,
} from "./pixi-stage/pointer-input";

export type PixiStageApi = {
  app: Application;
  world: Container;
  setCamera: (s: CameraState) => void;
  getCamera: () => CameraState;
};

export type CreatePixiStageOptions = {
  locked?: boolean;
  onReady?: (api: PixiStageApi) => void;
};

/** Framework-free port of BimSavage `PixiStage` (React shell). */
export async function createPixiStage(
  host: HTMLElement,
  options: CreatePixiStageOptions = {},
): Promise<{ api: PixiStageApi; destroy: () => void }> {
  let locked = options.locked ?? false;
  const instance = new Application();
  await instance.init({
    background: PIXI_PALETTE.stageBg,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  host.appendChild(instance.canvas);
  instance.canvas.style.display = "block";
  instance.canvas.style.width = "100%";
  instance.canvas.style.height = "100%";
  instance.canvas.style.touchAction = "none";

  const camera: CameraState = { x: 0, y: 0, zoom: 1 };
  const pan = { active: false, lastX: 0, lastY: 0 };

  const world = new Container();
  instance.stage.addChild(world);

  const viewport = () => ({
    width: instance.screen.width,
    height: instance.screen.height,
  });

  const syncCamera = () => {
    applyCameraToContainer(world, camera, viewport());
  };

  const resizeToHost = () => {
    const { clientWidth, clientHeight } = host;
    if (clientWidth < 1 || clientHeight < 1) return;
    instance.renderer.resize(clientWidth, clientHeight);
    syncCamera();
  };
  resizeToHost();
  const resizeObserver = new ResizeObserver(resizeToHost);
  resizeObserver.observe(host);

  const setCamera = (s: CameraState) => {
    camera.x = s.x;
    camera.y = s.y;
    camera.zoom = s.zoom;
    syncCamera();
  };
  const getCamera = () => ({ ...camera });

  const api: PixiStageApi = { app: instance, world, setCamera, getCamera };
  syncCamera();

  const onWheel = (e: WheelEvent) => {
    if (locked) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const vp = viewport();

    if (isTrackpadPanWheel(e)) {
      const next = applyPan(camera, -e.deltaX, -e.deltaY);
      camera.x = next.x;
      camera.y = next.y;
      syncCamera();
      return;
    }

    const worldPt = screenToWorld(camera, sx, sy, vp);
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const next = applyZoomAt(camera, worldPt.x, worldPt.y, factor, DEFAULT_CAMERA_LIMITS);
    camera.x = next.x;
    camera.y = next.y;
    camera.zoom = next.zoom;
    syncCamera();
  };

  const endPan = () => {
    pan.active = false;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (locked) return;
    if (!shouldStartPanOnPointerDown(e)) return;
    pan.active = true;
    pan.lastX = e.clientX;
    pan.lastY = e.clientY;
    host.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pan.active || locked) return;
    const dx = e.clientX - pan.lastX;
    const dy = e.clientY - pan.lastY;
    pan.lastX = e.clientX;
    pan.lastY = e.clientY;
    const next = applyPan(camera, dx, dy);
    camera.x = next.x;
    camera.y = next.y;
    syncCamera();
  };

  const onContextMenu = (e: Event) => e.preventDefault();

  host.addEventListener("wheel", onWheel, { passive: false });
  host.addEventListener("contextmenu", onContextMenu);
  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerup", endPan);
  host.addEventListener("pointercancel", endPan);
  host.addEventListener("pointerleave", endPan);

  instance.stage.eventMode = locked ? "none" : "static";
  options.onReady?.(api);

  const destroy = () => {
    pan.active = false;
    host.removeEventListener("wheel", onWheel);
    host.removeEventListener("contextmenu", onContextMenu);
    host.removeEventListener("pointerdown", onPointerDown);
    host.removeEventListener("pointermove", onPointerMove);
    host.removeEventListener("pointerup", endPan);
    host.removeEventListener("pointercancel", endPan);
    host.removeEventListener("pointerleave", endPan);
    resizeObserver.disconnect();
    safeDestroyApplication(instance);
  };

  return { api, destroy };
}
