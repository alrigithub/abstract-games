import type { InteractionApi, InteractionOptions, InteractionView, Point, ReservePick, Selection } from './types';

/** Max pointer movement (px) that still counts as a tap. */
export const TAP_MOVE_THRESHOLD = 8;

interface TapPress {
  id: number;
  origin: Point;
}

/**
 * Two-tap placement: tap a legal source (cell stack or reserve), then tap a legal target.
 * Hover updates {@link InteractionView.target} for ghost previews; never enters drag mode.
 */
export function createTapInteraction(options: InteractionOptions): InteractionApi {
  const { element } = options;
  let view: InteractionView = {
    selection: null,
    dragging: false,
    pointer: null,
    origin: null,
    target: null,
    progress: 0,
  };
  let press: TapPress | null = null;
  let disposed = false;

  const emit = () => options.onView({ ...view, selection: view.selection ? { ...view.selection } : null });
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

  const cancel = () => {
    press = null;
    view = { selection: null, dragging: false, pointer: null, origin: null, target: null, progress: 0 };
    emit();
  };

  const select = (selection: Selection, pointer: Point | null, target: number | null) => {
    view = { selection, dragging: false, pointer, origin: pointer, target, progress: 0 };
    emit();
  };

  const commit = (target: number | ReservePick) => {
    const selection = view.selection;
    cancel();
    if (!selection) return;
    if (typeof target === 'number') options.onCommit(selection, target);
    else options.onReserveCommit?.(selection, target);
  };

  const handleTap = (clientX: number, clientY: number) => {
    if (!canInteract()) return;
    const cell = options.hitTest(clientX, clientY);
    const reserve = options.hitReserve?.(clientX, clientY) ?? null;
    const point: Point = { x: clientX, y: clientY };

    if (view.selection) {
      if (cell !== null && validCell(cell)) {
        commit(cell);
        return;
      }
      if (reserve && options.onReserveCommit) {
        commit(reserve);
        return;
      }
    }

    if (reserve && canPickReserve(reserve)) {
      select({ source: reserve, count: 1 }, point, cell);
      return;
    }

    if (cell !== null && canPickCell(cell)) {
      select({ source: cell, count: 1 }, point, cell);
      return;
    }

    if (cell !== null && validCell(cell) && options.tryDirectPlace?.(cell)) {
      return;
    }

    cancel();
  };

  const onDown = (event: PointerEvent) => {
    if (disposed || event.button !== 0 || event.isPrimary === false || element.dataset.cameraGesture === 'true') return;
    if (!canInteract()) return;
    press = { id: event.pointerId, origin: { x: event.clientX, y: event.clientY } };
  };

  const onMove = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    view.pointer = { x: event.clientX, y: event.clientY };
    if (view.selection) {
      view.target = options.hitTest(event.clientX, event.clientY);
      emit();
    }
  };

  const onUp = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    const origin = press.origin;
    press = null;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > TAP_MOVE_THRESHOLD) {
      view.pointer = null;
      emit();
      return;
    }
    event.preventDefault();
    handleTap(event.clientX, event.clientY);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (press?.id === event.pointerId) press = null;
    cancel();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && view.selection) {
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
  window.addEventListener('keydown', onKey, true);

  const tapCell = (index: number) => {
    if (!validCell(index)) return;
    if (view.selection) {
      commit(index);
      return;
    }
    if (!canPickCell(index)) return;
    select({ source: index, count: 1 }, null, index);
  };

  return {
    selectReserve(pick) {
      if (!canInteract() || !canPickReserve(pick)) return;
      select({ source: pick, count: 1 }, null, null);
    },
    startReserve(event, pick) {
      if (!canInteract() || !canPickReserve(pick)) return;
      event.preventDefault();
      select({ source: pick, count: 1 }, { x: event.clientX, y: event.clientY }, options.hitTest(event.clientX, event.clientY));
    },
    activateCell(index: number) {
      tapCell(index);
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
      view.selection = { ...view.selection, count: Math.max(1, Math.min(height, Math.floor(count))) };
      emit();
    },
    getSelection: () => (view.selection ? { ...view.selection } : null),
    cancel,
    dispose() {
      if (disposed) return;
      disposed = true;
      press = null;
      cancel();
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('lostpointercapture', onPointerCancel);
      element.removeEventListener('camera-gesture', onCameraGesture);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      window.removeEventListener('keydown', onKey, true);
    },
  };
}

/** Programmatic two-tap: select source then commit to target (for AI / tests). */
export async function tapTransfer(
  api: InteractionApi,
  from: number,
  to: number,
  gapMs = 0,
): Promise<void> {
  api.cancel();
  api.activateCell(from);
  if (!api.getSelection()) throw new Error('tapTransfer: could not select source');
  if (gapMs > 0) await new Promise(r => setTimeout(r, gapMs));
  api.activateCell(to);
}
