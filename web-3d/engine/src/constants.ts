/** Timings and motion copied 1:1 from Alex's Tak studio (`tak-src/src/scene.ts`, `interaction.ts`, `state.ts`). */
export const ANIMATION = {
  /** Default piece move duration (ms). */
  DURATION: 180,
  /** Lift / pickup vertical move (ms). */
  LIFT_DURATION: 150,
  /** Vertical lift while dragging (world units). */
  LIFT: 0.28,
  /** Gap above board surface for stack bases (world units). */
  FLOOR: 0.018,
  /** Delay after pickup before horizontal follow eases (ms). */
  PICKUP_HORIZONTAL_DELAY: 85,
  /** Horizontal nudge while selected (ms). */
  HORIZONTAL_DURATION: 60,
  /** Out cubic ease: `1 - (1 - t) ** 3` */
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  /** Marker / stone flip duration (ms), matched to Bevy Yinsh GUI and Tak studio. */
  FLIP_DURATION: 500,
} as const;

export const INTERACTION = {
  /** Ms between each additional piece picked up from a held stack. */
  HOLD_INTERVAL: 500,
  DRAG_THRESHOLD: 6,
  RESERVE_STACK_SIZE: 7,
} as const;

export const BOARD = {
  /** Thin visual slab (grid lines sit on y≈0). */
  SLAB: 0.06,
  LINE_W: 0.018,
  RADIAL_SEGMENTS: 32,
  EDGE_THRESHOLD_TAK: 20,
  EDGE_THRESHOLD_GOMOKU: 25,
  EDGE_THRESHOLD_BOOP: 20,
  OUTLINE_EXPAND: 0.004,
  SHADOW_SCALE: 1.04,
  SHADOW_Y: 0.006,
  CONTACT_BLOB_SOFT_SCALE: 1.12,
  CONTACT_BLOB_OPACITY: 0.6,
} as const;

export const CAMERA = {
  position: [9, 9, 9] as const,
  near: 0.1,
  far: 80,
  rotateSpeed: 0.65,
  zoomSpeed: 0.8,
  minPolarAngle: 0.22,
  maxPolarAngle: 1.18,
  minZoom: 0.3,
  maxZoom: 2.8,
  framePadding: 1.18,
  maxPixelRatio: 2,
  minRenderScale: 1.5,
  maxBufferPixels: 3_000_000,
} as const;
