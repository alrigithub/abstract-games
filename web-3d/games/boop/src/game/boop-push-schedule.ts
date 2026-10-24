import type { PieceTracker } from './piece-tracker';
import type { EffectsView } from './types';

/** One publishSnapshot + sleep cycle per placement boop (all pushes in parallel). */
export const BOOP_PUSH_ANIMATION_PHASES = 1;

/** Apply every displacement and off-board exit before the single push animation snapshot. */
export function applyParallelBoopPushEffects(
  tracker: PieceTracker,
  effects: Pick<EffectsView, 'displacements' | 'off_board'>,
): void {
  for (const d of effects.displacements) {
    tracker.moveBoardId(d.from, d.to);
  }
  for (const o of effects.off_board) {
    const id = tracker.ensureIdAt(o.from.x, o.from.y, o.player, o.kind);
    tracker.removeFromBoard(o.from.x, o.from.y);
    tracker.addRestingFromBoop(id, o.player, o.kind, o.from, o);
  }
}

/** Expected animation phases for a boop burst (0 when nothing moves). */
export function boopPushAnimationPhaseCount(effects: Pick<EffectsView, 'displacements' | 'off_board'>): number {
  return effects.displacements.length + effects.off_board.length > 0 ? BOOP_PUSH_ANIMATION_PHASES : 0;
}
