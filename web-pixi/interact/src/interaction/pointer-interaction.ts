import type { InteractHooks, InteractionView, PickSource, Point, Selection } from "../types.ts";
import { countSelectedHold } from "../stack-model.ts";
import { DRAG_THRESHOLD_PX, HOLD_INTERVAL_MS } from "../tak-feel-constants.ts";

export { DRAG_THRESHOLD_PX };

interface Press {
  id: number;
  startedAt: number;
  interval: number;
  height: number;
  holding: boolean;
  cancelOnTap: boolean;
  commitOnTap: boolean;
}

export interface PointerInteractionOptions {
  element: HTMLElement;
  hooks: InteractHooks;
  hitCell: (clientX: number, clientY: number) => number | null;
  hitTray: (clientX: number, clientY: number) => PickSource | null;
  holdIntervalMs?: () => number;
  onView: (view: InteractionView) => void;
}

export interface PointerInteractionApi {
  getView(): InteractionView;
  cancel(): void;
  dispose(): void;
}

export function createPointerInteraction(
  options: PointerInteractionOptions,
): PointerInteractionApi {
  const { element, hooks } = options;
  let view: InteractionView = {
    selection: null,
    dragging: false,
    pointer: null,
    hoverCell: null,
    progress: 0,
  };
  let press: Press | null = null;
  let frame: number | null = null;
  let disposed = false;

  const emit = () => {
    options.onView({
      ...view,
      selection: view.selection ? { ...view.selection } : null,
    });
    hooks.onSelectionChange?.(view.selection);
  };

  const stackHeightFor = (source: PickSource): number => {
    if (source.type === "cell") return hooks.getCells()[source.index]?.length ?? 0;
    return hooks.getTray(source.side);
  };

  const stopFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };

  const updateHold = (now: number) => {
    if (!press?.holding || !view.selection) return;
    const elapsed = Math.max(0, now - press.startedAt);
    const count = countSelectedHold(elapsed, press.height, press.interval);
    view.selection = { ...view.selection, count };
    view.progress = count < press.height ? (elapsed % press.interval) / press.interval : 0;
  };

  const tick = (now: number) => {
    frame = null;
    if (!press?.holding || disposed) return;
    updateHold(now);
    emit();
    if (view.selection && view.selection.count < press.height) {
      frame = requestAnimationFrame(tick);
    }
  };

  const releaseCapture = (id: number) => {
    try {
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    } catch {
      /* already released */
    }
  };

  const finishPress = () => {
    const id = press?.id;
    press = null;
    stopFrame();
    if (id !== undefined) releaseCapture(id);
    view = { ...view, dragging: false, pointer: null, progress: 0 };
  };

  const cancel = () => {
    finishPress();
    view.selection = null;
    view.hoverCell = null;
    emit();
  };

  const commit = (target: number) => {
    const selection = view.selection;
    finishPress();
    if (selection) hooks.onCommit(selection, target);
    view.selection = null;
    view.hoverCell = null;
    emit();
  };

  const sameSource = (a: PickSource, b: PickSource): boolean => {
    if (a.type !== b.type) return false;
    if (a.type === "cell" && b.type === "cell") return a.index === b.index;
    if (a.type === "tray" && b.type === "tray") {
      return a.side === b.side && a.slot === b.slot;
    }
    return false;
  };

  const begin = (event: PointerEvent, trayHit: PickSource | null) => {
    if (disposed || press || event.button !== 0 || event.isPrimary === false) return;
    const previous = view.selection;
    const trayReserve = trayHit?.type === "tray" ? trayHit : null;
    const sameTray =
      previous &&
      previous.source.type === "tray" &&
      trayReserve &&
      sameSource(previous.source, trayReserve);
    const trayDestination = trayReserve && previous && !sameTray;

    let height = 1;
    let holding = false;
    let commitOnTap = false;

    if (trayDestination) commitOnTap = true;
    else if (trayReserve && hooks.canPick(trayReserve)) {
      view.selection = { source: trayReserve, count: 1 };
      height = stackHeightFor(trayReserve);
      holding = height > 1;
    } else if (previous && trayHit && !sameSource(previous.source, trayHit)) {
      commitOnTap = true;
    } else {
      const cell = options.hitCell(event.clientX, event.clientY);
      if (cell === null) return;
      if (previous && !sameSource(previous.source, { type: "cell", index: cell })) {
        commitOnTap = true;
      } else if (hooks.canPick({ type: "cell", index: cell })) {
        height = stackHeightFor({ type: "cell", index: cell });
        if (!height) return;
        view.selection = { source: { type: "cell", index: cell }, count: 1 };
        holding = height > 1;
      } else return;
    }

    event.preventDefault();
    const point: Point = { x: event.clientX, y: event.clientY };
    const configured = options.holdIntervalMs?.() ?? HOLD_INTERVAL_MS;
    const interval =
      Number.isFinite(configured) && configured > 0 ? configured : HOLD_INTERVAL_MS;
    press = {
      id: event.pointerId,
      startedAt: performance.now(),
      interval,
      height,
      holding,
      cancelOnTap:
        !!(previous && trayHit && sameSource(previous.source, trayHit)) ||
        !!sameTray,
      commitOnTap,
    };
    view = {
      ...view,
      dragging: false,
      pointer: point,
      hoverCell: options.hitCell(event.clientX, event.clientY),
      progress: 0,
    };
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      /* ok */
    }
    if (holding && height > 1) frame = requestAnimationFrame(tick);
    emit();
  };

  const onDown = (event: PointerEvent) => {
    begin(event, options.hitTray(event.clientX, event.clientY));
  };

  const onMove = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    event.preventDefault();
    const origin = view.pointer;
    if (
      origin &&
      !view.dragging &&
      Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > DRAG_THRESHOLD_PX
    ) {
      updateHold(performance.now());
      press.holding = false;
      stopFrame();
      view.dragging = true;
      view.progress = 0;
    }
    view.pointer = { x: event.clientX, y: event.clientY };
    view.hoverCell = options.hitCell(event.clientX, event.clientY);
    emit();
  };

  const onUp = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    event.preventDefault();
    updateHold(performance.now());
    onMove(event);
    const target = options.hitCell(event.clientX, event.clientY);
    if (view.dragging || press.commitOnTap) {
      if (target !== null) commit(target);
      else cancel();
    } else if (press.cancelOnTap && performance.now() - press.startedAt < press.interval) {
      cancel();
    } else {
      finishPress();
      emit();
    }
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (press?.id === event.pointerId) cancel();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && (press || view.selection)) {
      event.preventDefault();
      cancel();
    }
  };

  element.addEventListener("pointerdown", onDown);
  element.addEventListener("lostpointercapture", onPointerCancel);
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("pointercancel", onPointerCancel, true);
  window.addEventListener("keydown", onKey, true);
  emit();

  return {
    getView: () => ({ ...view, selection: view.selection ? { ...view.selection } : null }),
    cancel,
    dispose() {
      if (disposed) return;
      finishPress();
      disposed = true;
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("lostpointercapture", onPointerCancel);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
      window.removeEventListener("keydown", onKey, true);
    },
  };
}
