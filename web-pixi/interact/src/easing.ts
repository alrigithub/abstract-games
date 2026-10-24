/** Cubic ease-out — matches `scene.ts` render lerp. */
export function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) ** 3;
}

export function easeOutBack(t: number, overshoot = 1.2): number {
  const c = Math.max(0, Math.min(1, t));
  const s = 1.70158 * overshoot;
  return 1 + (s + 1) * (c - 1) ** 3 + s * (c - 1) ** 2;
}

export function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}
