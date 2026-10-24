/** Boop demo pacing (engine default move is 180ms out-cubic). */
export const BOOP_ANIM = {
  /** ~2.25× engine default piece move. */
  MOVE_MS: 405,
  /** Extra beat between chained boop / graduation steps. */
  STEP_GAP_MS: 35,
  AI_PAUSE_MS: 400,
} as const;

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Patch shared engine timing for this demo bundle only. */
export function applyBoopAnimationPacing(anim: {
  DURATION: number;
  easeOutCubic: (t: number) => number;
}) {
  anim.DURATION = BOOP_ANIM.MOVE_MS;
  anim.easeOutCubic = easeInOutCubic;
}
