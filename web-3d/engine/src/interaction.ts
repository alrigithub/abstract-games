import { INTERACTION } from './constants';
import { countSelected } from './stack';
import type { InteractionApi, InteractionOptions, InteractionView, Point, ReservePick, Selection } from './types';

export const DRAG_THRESHOLD = INTERACTION.DRAG_THRESHOLD;

interface Press {
  id: number;
  startedAt: number;
  interval: number;
  height: number;
  holding: boolean;
  cancelOnTap: boolean;
  commitOnTap: boolean;
}

export function createInteraction(options: InteractionOptions): InteractionApi {
  const { element } = options;
  let view: InteractionView = { selection: null, dragging: false, pointer: null, origin: null, target: null, progress: 0 };
  let press: Press | null = null;
  let frame: number | null = null;
  let disposed = false;

  const emit = () => options.onView({ ...view, selection: view.selection ? { ...view.selection } : null });
  const stopFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
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
  const finishPress = () => {
    const id = press?.id;
    press = null;
    stopFrame();
    if (id !== undefined) releaseCapture(id);
    view = { ...view, dragging: false, pointer: null, origin: null, target: null, progress: 0 };
  };
  const cancel = () => {
    finishPress();
    view.selection = null;
    emit();
  };
  const commit = (target: number | ReservePick) => {
    const selection = view.selection;
    finishPress();
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
  const reserveKey = (pick: ReservePick) => `${pick.player}:${pick.shape}:${pick.pile}`;
  const sameReserve = (a: ReservePick, b: ReservePick) => reserveKey(a) === reserveKey(b);

  const selectCell = (index: number) => {
    if (!validCell(index)) return;
    if (view.selection) {
      if (view.selection.source === index) cancel();
      else commit(index);
    } else if (options.getSnapshot().cells[index]!.length) {
      view.selection = { source: index, count: 1 };
      emit();
    }
  };
  const begin = (event: PointerEvent, reserve?: ReservePick) => {
    if (disposed || press || event.button !== 0 || event.isPrimary === false || element.dataset.cameraGesture === 'true') return;
    if (!canInteract()) return;
    const previous = view.selection;
    const reservePick = reserve;
    const samePick = previous !== null && typeof previous.source !== 'number' && reservePick !== undefined && sameReserve(previous.source, reservePick);
    const reserveDestination = reservePick !== undefined && previous !== null && !samePick;
    const resolvedReserve = reservePick && !reserveDestination ? options.hitReserve?.(event.clientX, event.clientY) ?? reservePick : null;
    if (reservePick && !resolvedReserve && !reserveDestination) return;
    const target = options.hitTest(event.clientX, event.clientY);
    const sameSource = previous !== null && typeof previous.source === 'number' && previous.source === target;
    let height = 1;
    let holding = false;
    let commitOnTap = false;
    if (reserveDestination) commitOnTap = true;
    else if (resolvedReserve && reservePick) {
      view.selection = { source: reservePick, count: 1 };
      const snap = options.getSnapshot();
      const slot = snap.reserves?.find(s => s.id === reservePick.slotId);
      height = slot?.count ?? 1;
      holding = height > 1;
    } else if (previous && !sameSource) commitOnTap = true;
    else if (target !== null && validCell(target)) {
      height = options.getSnapshot().cells[target]!.length;
      if (!height) return;
      view.selection = { source: target, count: 1 };
      holding = true;
    } else return;
    event.preventDefault();
    const point: Point = { x: event.clientX, y: event.clientY };
    const configuredInterval = options.getHoldInterval?.() ?? INTERACTION.HOLD_INTERVAL;
    const interval: number = Number.isFinite(configuredInterval) && configuredInterval > 0 ? configuredInterval : INTERACTION.HOLD_INTERVAL;
    press = { id: event.pointerId, startedAt: performance.now(), interval, height, holding, cancelOnTap: sameSource || samePick, commitOnTap };
    view = { ...view, dragging: false, pointer: point, origin: point, target, progress: 0 };
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      /* outside */
    }
    if (holding && height > 1) frame = requestAnimationFrame(tick);
    emit();
  };
  const onDown = (event: PointerEvent) => begin(event, options.hitReserve?.(event.clientX, event.clientY) ?? undefined);
  const onMove = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    event.preventDefault();
    const origin = view.origin!;
    if (!view.dragging && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > DRAG_THRESHOLD) {
      updateHold(performance.now());
      press.holding = false;
      stopFrame();
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
    updateHold(performance.now());
    onMove(event);
    const target = options.hitTest(event.clientX, event.clientY);
    if (view.dragging || press.commitOnTap) {
      if (target !== null && validCell(target)) commit(target);
      else {
        const reserve = options.hitReserve?.(event.clientX, event.clientY);
        if (reserve && options.onReserveCommit) commit(reserve);
        else cancel();
      }
    } else if (press.cancelOnTap && performance.now() - press.startedAt < press.interval) cancel();
    else {
      finishPress();
      emit();
    }
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
      if (disposed || !canInteract()) return;
      finishPress();
      view.selection = { source: pick, count: 1 };
      emit();
    },
    startReserve: (event, pick) => begin(event, pick),
    activateCell(index) {
      if (!disposed && !press && canInteract()) selectCell(index);
    },
    selectCount(count) {
      if (!view.selection || !Number.isFinite(count)) return;
      const height =
        typeof view.selection.source === 'number'
          ? options.getSnapshot().cells[view.selection.source]?.length ?? 0
          : options.getSnapshot().reserves?.find(s => sameReserve(s as unknown as ReservePick, view.selection!.source as ReservePick))?.count ?? 0;
      if (!height) {
        cancel();
        return;
      }
      if (press) press.holding = false;
      stopFrame();
      view.selection = { ...view.selection, count: Math.max(1, Math.min(height, Math.floor(count))) };
      view.progress = 0;
      emit();
    },
    getSelection: () => (view.selection ? { ...view.selection } : null),
    cancel,
    dispose() {
      if (disposed) return;
      finishPress();
      disposed = true;
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
