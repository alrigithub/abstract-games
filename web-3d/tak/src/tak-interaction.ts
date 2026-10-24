import { INTERACTION } from '@abstract/three-engine';
import type { InteractionApi, InteractionOptions, InteractionView, Point, ReservePick } from '@abstract/three-engine';
import { countSelected } from './state';

const DRAG_THRESHOLD = INTERACTION.DRAG_THRESHOLD;

/** Max pointer movement (px) that still counts as a tap (matches engine tap interaction). */
export const TAP_MOVE_THRESHOLD = 8;

interface Press {
  id: number;
  startedAt: number;
  interval: number;
  height: number;
  holding: boolean;
  origin: Point;
  /** True when pointerdown happened while a selection was already active. */
  resolveSelection: boolean;
}

/**
 * Tak interaction: tap-select (reserve stays selected until place/cancel) plus press-hold-drag for stacks.
 */
export function createTakInteraction(options: InteractionOptions): InteractionApi {
  const { element } = options;
  let view: InteractionView = { selection: null, dragging: false, pointer: null, origin: null, target: null, progress: 0 };
  let press: Press | null = null;
  let frame: number | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const emit = () => options.onView({ ...view, selection: view.selection ? { ...view.selection } : null });
  const stopFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  const stopHoldTimer = () => {
    if (holdTimer !== null) clearTimeout(holdTimer);
    holdTimer = null;
  };
  const startHoldTimer = () => {
    stopHoldTimer();
    const schedule = () => {
      if (!press?.holding || disposed) return;
      const elapsed = Math.max(0, performance.now() - press.startedAt);
      const delay = press.interval - (elapsed % press.interval);
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (!press?.holding || disposed) return;
        updateHold(performance.now());
        emit();
        if (view.selection && press && view.selection.count >= press.height) return;
        schedule();
      }, delay) as unknown as ReturnType<typeof setInterval>;
    };
    schedule();
  };
  const updateHold = (now: number) => {
    if (!press?.holding || !view.selection) return;
    const elapsed = Math.max(0, now - press.startedAt);
    const count = countSelected(elapsed, press.height, press.interval);
    view.selection = { ...view.selection, count };
    view.progress = count < press.height ? (elapsed % press.interval) / press.interval : 0;
  };
  const tick = (now: number) => {
    frame = null;
    if (!press?.holding || disposed) return;
    updateHold(now);
    emit();
    if (view.selection && view.selection.count < press.height) frame = requestAnimationFrame(tick);
  };
  const releaseCapture = (id: number) => {
    try {
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    } catch {
      /* ended */
    }
  };
  const clearPressMotion = () => {
    const id = press?.id;
    press = null;
    stopFrame();
    stopHoldTimer();
    if (id !== undefined) releaseCapture(id);
    view = { ...view, dragging: false, pointer: null, origin: null, target: null, progress: 0 };
  };
  const cancel = () => {
    clearPressMotion();
    view.selection = null;
    emit();
  };
  const commit = (target: number | ReservePick) => {
    const selection = view.selection;
    clearPressMotion();
    if (selection) {
      if (typeof target === 'number') options.onCommit(selection, target);
      else options.onReserveCommit?.(selection, target);
    }
    view.selection = null;
    emit();
  };
  const canInteract = () => options.canInteract?.() !== false;
  const validCell = (index: number) => {
    const snap = options.getSnapshot();
    return Number.isInteger(index) && index >= 0 && index < snap.cellCount;
  };

  const pickHeight = (source: number, snap: ReturnType<InteractionOptions['getSnapshot']>) => {
    const stack = snap.cells[source] ?? [];
    if (!stack.length) return 0;
    const capped = options.getPickHeight?.(source, snap);
    return capped !== undefined ? Math.max(0, Math.min(stack.length, Math.floor(capped))) : stack.length;
  };

  const canPickCell = (cell: number) => {
    if (!validCell(cell)) return false;
    const snap = options.getSnapshot();
    return pickHeight(cell, snap) > 0;
  };

  const canPickReserve = (pick: ReservePick) => {
    const snap = options.getSnapshot();
    const slot = snap.reserves?.find(s => s.id === pick.slotId);
    return (slot?.count ?? 0) > 0;
  };

  const select = (selection: InteractionView['selection'], pointer: Point | null, target: number | null) => {
    view = { selection, dragging: false, pointer, origin: pointer, target, progress: 0 };
    emit();
  };

  const handleTapWithSelection = (clientX: number, clientY: number) => {
    const selection = view.selection;
    if (!selection) return;
    const cell = options.hitTest(clientX, clientY);
    const reserve = options.hitReserve?.(clientX, clientY) ?? null;

    if (cell !== null && validCell(cell)) {
      if (typeof selection.source === 'number' && selection.source === cell) {
        cancel();
        return;
      }
      commit(cell);
      return;
    }
    if (reserve && options.onReserveCommit) {
      commit(reserve);
      return;
    }
    cancel();
  };

  const handleTapNewSelection = (clientX: number, clientY: number) => {
    const reserve = options.hitReserve?.(clientX, clientY) ?? null;
    const cell = options.hitTest(clientX, clientY);
    const point: Point = { x: clientX, y: clientY };

    if (reserve && canPickReserve(reserve)) {
      select({ source: reserve, count: 1 }, point, cell);
      return;
    }
    if (cell !== null && canPickCell(cell)) {
      select({ source: cell, count: 1 }, point, cell);
      return;
    }
    cancel();
  };

  const beginPick = (event: PointerEvent, reserve?: ReservePick) => {
    const cell = options.hitTest(event.clientX, event.clientY);
    let height = 0;
    let selection: InteractionView['selection'] = null;
    let holding = false;

    if (reserve) {
      const snap = options.getSnapshot();
      const slot = snap.reserves?.find(s => s.id === reserve.slotId);
      height = slot?.count ?? 0;
      if (height <= 0) return;
      selection = { source: reserve, count: 1 };
      holding = height > 1;
    } else if (cell !== null && validCell(cell)) {
      const snap = options.getSnapshot();
      height = pickHeight(cell, snap);
      if (!height) return;
      selection = { source: cell, count: 1 };
      holding = height > 1;
    } else return;

    event.preventDefault();
    const point: Point = { x: event.clientX, y: event.clientY };
    const configuredInterval = options.getHoldInterval?.() ?? INTERACTION.HOLD_INTERVAL;
    const interval: number = Number.isFinite(configuredInterval) && configuredInterval > 0 ? configuredInterval : INTERACTION.HOLD_INTERVAL;
    press = {
      id: event.pointerId,
      startedAt: performance.now(),
      interval,
      height,
      holding,
      origin: point,
      resolveSelection: false,
    };
    view = { selection, dragging: false, pointer: point, origin: point, target: cell, progress: 0 };
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      /* outside stage */
    }
    if (holding) {
      frame = requestAnimationFrame(tick);
      startHoldTimer();
    }
    emit();
  };

  const onDown = (event: PointerEvent) => {
    if (disposed || press || event.button !== 0 || event.isPrimary === false || element.dataset.cameraGesture === 'true') return;
    if (!canInteract()) return;

    if (view.selection) {
      event.preventDefault();
      press = {
        id: event.pointerId,
        startedAt: performance.now(),
        interval: INTERACTION.HOLD_INTERVAL,
        height: 0,
        holding: false,
        origin: { x: event.clientX, y: event.clientY },
        resolveSelection: true,
      };
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        /* outside */
      }
      return;
    }

    beginPick(event, options.hitReserve?.(event.clientX, event.clientY) ?? undefined);
  };

  const onMove = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    if (press.resolveSelection) return;
    event.preventDefault();
    const origin = view.origin ?? press.origin;
    if (!view.dragging && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > DRAG_THRESHOLD) {
      updateHold(performance.now());
      press.holding = false;
      stopFrame();
      stopHoldTimer();
      view.dragging = true;
      view.progress = 0;
    }
    view.pointer = { x: event.clientX, y: event.clientY };
    view.target = options.hitTest(event.clientX, event.clientY);
    emit();
  };

  const onUp = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    event.preventDefault();

    if (press.resolveSelection) {
      const moved = Math.hypot(event.clientX - press.origin.x, event.clientY - press.origin.y);
      const id = press.id;
      press = null;
      releaseCapture(id);
      if (moved > TAP_MOVE_THRESHOLD) {
        view.pointer = null;
        emit();
        return;
      }
      handleTapWithSelection(event.clientX, event.clientY);
      return;
    }

    updateHold(performance.now());
    onMove(event);

    if (view.dragging) {
      const target = options.hitTest(event.clientX, event.clientY);
      if (target !== null && validCell(target)) commit(target);
      else {
        const reserve = options.hitReserve?.(event.clientX, event.clientY);
        if (reserve && options.onReserveCommit) commit(reserve);
        else cancel();
      }
      return;
    }

    const moved = Math.hypot(event.clientX - press.origin.x, event.clientY - press.origin.y);
    if (moved > TAP_MOVE_THRESHOLD) {
      clearPressMotion();
      emit();
      return;
    }

    const hadSelection = view.selection;
    clearPressMotion();
    if (!hadSelection) handleTapNewSelection(event.clientX, event.clientY);
    else view.selection = hadSelection;
    emit();
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (press?.id === event.pointerId) cancel();
  };
  const onBlur = (event: Event) => {
    if (event.target === window) cancel();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && (press || view.selection)) {
      event.preventDefault();
      cancel();
    }
  };
  const onCameraGesture = (event: Event) => {
    if ((event as CustomEvent<{ active: boolean }>).detail?.active) cancel();
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('lostpointercapture', onPointerCancel);
  element.addEventListener('camera-gesture', onCameraGesture);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onPointerCancel, true);
  window.addEventListener('blur', onBlur, true);
  window.addEventListener('keydown', onKey, true);
  emit();

  return {
    selectReserve(pick) {
      if (disposed || !canInteract() || !canPickReserve(pick)) return;
      clearPressMotion();
      view.selection = { source: pick, count: 1 };
      view.dragging = true;
      emit();
    },
    startReserve: (event, pick) => beginPick(event, pick),
    activateCell(index: number) {
      if (!validCell(index)) return;
      if (view.selection) {
        commit(index);
        return;
      }
      if (!canPickCell(index)) return;
      select({ source: index, count: 1 }, null, index);
    },
    selectCount(count: number) {
      if (!view.selection || !Number.isFinite(count)) return;
      const snap = options.getSnapshot();
      const height =
        typeof view.selection.source === 'number'
          ? pickHeight(view.selection.source, snap)
          : snap.reserves?.find(s => s.id === (view.selection!.source as ReservePick).slotId)?.count ?? 0;
      if (!height) {
        cancel();
        return;
      }
      if (press) press.holding = false;
      stopFrame();
      stopHoldTimer();
      view.selection = { ...view.selection, count: Math.max(1, Math.min(height, Math.floor(count))) };
      view.progress = 0;
      view.dragging = true;
      emit();
    },
    getSelection: () => (view.selection ? { ...view.selection } : null),
    cancel,
    dispose() {
      if (disposed) return;
      clearPressMotion();
      disposed = true;
      view.selection = null;
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('lostpointercapture', onPointerCancel);
      element.removeEventListener('camera-gesture', onCameraGesture);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      window.removeEventListener('blur', onBlur, true);
      window.removeEventListener('keydown', onKey, true);
    },
  };
}
