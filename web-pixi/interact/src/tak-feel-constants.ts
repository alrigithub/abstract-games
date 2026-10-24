/**
 * Motion and interaction timings ported from Alex's Three.js Tak sandbox.
 * Sources: `/cursor/stores/bot/tak-src/src/scene.ts`, `interaction.ts`, `state.ts`.
 */

/** `scene.ts` — default piece travel (board ↔ board, settle to stack height). */
export const PIECE_MOVE_DURATION_MS = 180;

/** `scene.ts` — vertical lift while a stack is selected / carried. */
export const PIECE_LIFT_DURATION_MS = 150;

/** `scene.ts` — world-space lift above support while selected (`LIFT = 0.28`). */
export const LIFT_WORLD_UNITS = 0.28;

/** `scene.ts` — first visible board height for stacked pieces (`FLOOR = 0.018`). */
export const STACK_FLOOR_WORLD_UNITS = 0.018;

/** `scene.ts` — horizontal snap to pointer cell after pickup (`horizontalStarted = pickupAt + 85`). */
export const CARRIED_HORIZONTAL_DELAY_MS = 85;

/** `scene.ts` — duration of horizontal snap while carried (`/ 60` in render loop). */
export const CARRIED_HORIZONTAL_DURATION_MS = 60;

/** `interaction.ts` — pixels before hold-to-split freezes and drag begins. */
export const DRAG_THRESHOLD_PX = 6;

/** `state.ts` — default hold interval for increasing picked stack count (`HOLD_INTERVAL`). */
export const HOLD_INTERVAL_MS = 400;

/** `scene.ts` — cubic ease-out used for position lerp: `1 - (1 - t)³`. */
export const EASE_OUT_CUBIC = "outCubic" as const;

/** 2D-only: squash/settle after landing (complements Three.js vertical lerp). */
export const PLACE_SETTLE_DURATION_MS = 90;

/** 2D-only: queued AI / spread drops between pieces in one move. */
export const SPREAD_STAGGER_MS = 55;

/** 2D-only: invalid placement return to origin. */
export const BOUNCE_BACK_DURATION_MS = 220;

/** `astra-bw.md` — grid line width as fraction of cell pitch. */
export const LINE_W_PITCH = 0.018;

/** `astra-bw.md` — board slab thickness in pitch units. */
export const BOARD_SLAB_THICKNESS_PITCH = 0.25;

/** `scene.ts` + `piece-geometry.ts` — map 3D lift to 2D vertical offset (≈ lift / flat height). */
export const LIFT_PITCH_FRACTION = LIFT_WORLD_UNITS / 0.14;

/** Ghost preview opacity (`scene.ts` ghost materials ~0.24–0.25). */
export const GHOST_ALPHA = 0.24;

/** Contact shadow at rest (`astra-bw.md`). */
export const SHADOW_SOFT_SCALE_REST = 1.12;
export const SHADOW_OPACITY_REST = 0.6;

/** Contact shadow while lifted (2D exaggeration of separation). */
export const SHADOW_SOFT_SCALE_LIFT = 1.45;
export const SHADOW_OPACITY_LIFT = 0.35;

/** Pick-up scale pop (2D counterpart to emissive + lift read). */
export const PICKUP_SCALE = 1.06;
export const PICKUP_TILT_RAD = 0.06;
