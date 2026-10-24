export function shouldStartPanOnPointerDown(
  e: Pick<PointerEvent, "button">,
): boolean {
  if (e.button === 0) return false;
  return false;
}

export function isPinchZoomWheel(
  e: Pick<WheelEvent, "ctrlKey" | "metaKey">,
): boolean {
  return e.ctrlKey || e.metaKey;
}

/** Trackpad two-finger pan often appears as wheel with deltaX or shift+wheel. */
export function isTrackpadPanWheel(
  e: Pick<
    WheelEvent,
    "deltaX" | "deltaY" | "ctrlKey" | "metaKey" | "shiftKey"
  >,
): boolean {
  if (isPinchZoomWheel(e)) return false;
  if (Math.abs(e.deltaX) > 0.5) return true;
  if (e.shiftKey && Math.abs(e.deltaY) > 0.5) return true;
  return false;
}
