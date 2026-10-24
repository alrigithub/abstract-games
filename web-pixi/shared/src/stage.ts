import { Application, Container } from "pixi.js";
import { PIXI_PALETTE } from "./palette";
import {
  applyCameraToContainer,
  applyPan,
  applyZoomAt,
  DEFAULT_CAMERA_LIMITS,
  screenToWorld,
  type CameraState,
} from "./camera";
import { safeDestroyApplication } from "./destroy-application";
import {
  isTrackpadPanWheel,
  shouldStartPanOnPointerDown,
} from "./pointer-input";

export type PixiStageApi = {
  app: Application;
  world: Container;
  setCamera: (s: CameraState) => void;
  getCamera: () => CameraState;
  syncCamera: () => void;
  destroy: () => void;
};

export type CreatePixiStageOptions = {
  locked?: boolean;
  backgroundAlpha?: number;
};

/** Framework-free port of BimSavage `PixiStage`. */
export async function createPixiStage(
  host: HTMLElement,
  options: CreatePixiStageOptions = {},
): Promise<PixiStageApi> {
  const instance = new Application();
  await instance.init({
    background: PIXI_PALETTE.stageBg,
    backgroundAlpha: options.backgroundAlpha ?? 1,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  host.appendChild(instance.canvas);
  instance.canvas.style.display = "block";
  instance.canvas.style.width = "100%";
  instance.canvas.style.height = "100%";
  instance.canvas.style.touchAction = "none";

  const world = new Container();
  instance.stage.addChild(world);

  let camera: CameraState = { x: 0, y: 0, zoom: 1 };
  let locked = options.locked ?? false;
  const pan = { active: false, lastX: 0, lastY: 0 };

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

  const resizeObserver = new ResizeObserver(resizeToHost);
  resizeObserver.observe(host);
  resizeToHost();

  const onWheel = (e: WheelEvent) => {
    if (locked) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const vp = viewport();

    if (isTrackpadPanWheel(e)) {
      camera = applyPan(camera, -e.deltaX, -e.deltaY);
      syncCamera();
      return;
    }

    const worldPt = screenToWorld(camera, sx, sy, vp);
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    camera = applyZoomAt(
      camera,
      worldPt.x,
      worldPt.y,
      factor,
      DEFAULT_CAMERA_LIMITS,
    );
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
    camera = applyPan(camera, dx, dy);
    syncCamera();
  };

  host.addEventListener("wheel", onWheel, { passive: false });
  const onContextMenu = (e: Event) => e.preventDefault();
  host.addEventListener("contextmenu", onContextMenu);
  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerup", endPan);
  host.addEventListener("pointercancel", endPan);
  host.addEventListener("pointerleave", endPan);

  syncCamera();

  const destroy = () => {
    resizeObserver.disconnect();
    host.removeEventListener("wheel", onWheel);
    host.removeEventListener("contextmenu", onContextMenu);
    host.removeEventListener("pointerdown", onPointerDown);
    host.removeEventListener("pointermove", onPointerMove);
    host.removeEventListener("pointerup", endPan);
    host.removeEventListener("pointercancel", endPan);
    host.removeEventListener("pointerleave", endPan);
    safeDestroyApplication(instance);
  };

  return {
    app: instance,
    world,
    setCamera: (s) => {
      camera = s;
      syncCamera();
    },
    getCamera: () => camera,
    syncCamera,
    destroy,
  };
}
