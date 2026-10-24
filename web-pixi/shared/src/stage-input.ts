import {
  applyPan,
  applyZoomAt,
  DEFAULT_CAMERA_LIMITS,
  screenToWorld,
  type CameraState,
} from "./camera";
import { isTrackpadPanWheel } from "./pointer-input";

export type StageInputOptions = {
  host: HTMLElement;
  getCamera: () => CameraState;
  setCamera: (state: CameraState) => void;
  onCameraChange?: () => void;
  isLocked?: () => boolean;
};

/** Camera wheel / context-menu input when the stage is not created via `createPixiStage`. */
export function attachPixiStageInput(opts: StageInputOptions): () => void {
  const pan = { active: false, lastX: 0, lastY: 0 };

  const viewport = () => ({
    width: opts.host.clientWidth,
    height: opts.host.clientHeight,
  });

  const sync = () => {
    opts.onCameraChange?.();
  };

  const onWheel = (e: WheelEvent) => {
    if (opts.isLocked?.()) return;
    e.preventDefault();
    const rect = opts.host.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const vp = viewport();

    if (isTrackpadPanWheel(e)) {
      opts.setCamera(applyPan(opts.getCamera(), -e.deltaX, -e.deltaY));
      sync();
      return;
    }

    const worldPt = screenToWorld(opts.getCamera(), sx, sy, vp);
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    opts.setCamera(
      applyZoomAt(
        opts.getCamera(),
        worldPt.x,
        worldPt.y,
        factor,
        DEFAULT_CAMERA_LIMITS,
      ),
    );
    sync();
  };

  const endPan = () => {
    pan.active = false;
  };

  const onPointerDown = (_e: PointerEvent) => {
    if (opts.isLocked?.()) return;
    pan.active = false;
  };

  const onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  const onPointerMove = (_e: PointerEvent) => {
    void pan;
  };

  opts.host.addEventListener("wheel", onWheel, { passive: false });
  opts.host.addEventListener("contextmenu", onContextMenu);
  opts.host.addEventListener("pointerdown", onPointerDown);
  opts.host.addEventListener("pointermove", onPointerMove);
  opts.host.addEventListener("pointerup", endPan);
  opts.host.addEventListener("pointercancel", endPan);
  opts.host.addEventListener("pointerleave", endPan);

  return () => {
    opts.host.removeEventListener("wheel", onWheel);
    opts.host.removeEventListener("contextmenu", onContextMenu);
    opts.host.removeEventListener("pointerdown", onPointerDown);
    opts.host.removeEventListener("pointermove", onPointerMove);
    opts.host.removeEventListener("pointerup", endPan);
    opts.host.removeEventListener("pointercancel", endPan);
    opts.host.removeEventListener("pointerleave", endPan);
  };
}
