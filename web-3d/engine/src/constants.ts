/** Timings and motion copied 1:1 from Alex's Tak studio (`tak-src/src/scene.ts`, `interaction.ts`, `state.ts`). */
export const ANIMATION = {
  /** Default piece move duration (ms). */
  DURATION: 180,
  /** Lift / pickup vertical move (ms). */
  LIFT_DURATION: 150,
  /** Vertical lift while dragging (world units). */
  LIFT: 0.28,
  /** @deprecated Resting stacks use {@link PLAYFIELD_SURFACE_Y}; kept for legacy imports only. */
  FLOOR: 0,
  /** Delay after pickup before horizontal follow eases (ms). */
  PICKUP_HORIZONTAL_DELAY: 85,
  /** Horizontal nudge while selected (ms). */
  HORIZONTAL_DURATION: 60,
  /** Out cubic ease: `1 - (1 - t) ** 3` */
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  /** Marker / stone flip duration (ms), matched to legacy Yinsh GUI timing. */
  FLIP_DURATION: 500,
} as const;

export const INTERACTION = {
  /** Ms between each additional piece picked up from a held stack. */
  HOLD_INTERVAL: 370,
  DRAG_THRESHOLD: 6,
  RESERVE_STACK_SIZE: 7,
} as const;

/** World Y of the shared playfield / table top (piece bases rest here). */
const BOARD_PLAYFIELD_SURFACE_Y = 0;
/** Grid line meshes sit this far above {@link BOARD_PLAYFIELD_SURFACE_Y} (avoids z-fighting with the ground). */
const BOARD_LINE_LIFT = 0.004;

export const BOARD = {
  /** World units per side of the shared infinite-style playfield plane. */
  PLAYFIELD_GROUND_SIZE: 8192,
  /** Linear fog matches {@link applyPlayfieldBackdrop} / scene background. */
  PLAYFIELD_FOG_NEAR: 42,
  PLAYFIELD_FOG_FAR: 165,
  /** Board thickness (0 = flat playfield plane at {@link PLAYFIELD_SURFACE_Y}). */
  SLAB: 0,
  /** Tak board thickness (same flat plane as other games). */
  TAK_SLAB: 0,
  /** Top of board / table where piece bases rest (world Y). */
  PLAYFIELD_SURFACE_Y: BOARD_PLAYFIELD_SURFACE_Y,
  /** Small lift for grid line meshes above {@link PLAYFIELD_SURFACE_Y}. */
  LINE_LIFT: BOARD_LINE_LIFT,
  /** World Y for grid / intersection line meshes (`PLAYFIELD_SURFACE_Y + LINE_LIFT`). */
  LINE_Y: BOARD_PLAYFIELD_SURFACE_Y + BOARD_LINE_LIFT,
  /** Contact shadow sits this far above the piece base (world Y). */
  SHADOW_CONTACT_EPSILON: 0.001,
  LINE_W: 0.009,
  RADIAL_SEGMENTS: 32,
  EDGE_THRESHOLD_TAK: 20,
  EDGE_THRESHOLD_GOMOKU: 25,
  EDGE_THRESHOLD_BOOP: 20,
  OUTLINE_EXPAND: 0.004,
  SHADOW_SCALE: 1.04,
  /** @deprecated Use SHADOW_CONTACT_EPSILON at piece base. */
  SHADOW_Y: 0.001,
  CONTACT_BLOB_SOFT_SCALE: 1.12,
  CONTACT_BLOB_OPACITY: 0.6,
  /**
   * Shared IBL strength for PBR GLBs ({@link applyBoardEnvironment}).
   * MeshBasic board/piece materials ignore this.
   */
  ENVIRONMENT_INTENSITY: 0.5,
  /** Decal under pieces (complements shadow maps). */
  PIECE_CONTACT_SHADOW_OPACITY: 0.24,
} as const;

/** Central tuning for the shared clay / maquette look (tone map, AO, key light). */
export const CLAY = {
  TONE_MAPPING_EXPOSURE: 0.98,
  AO_ENABLED: true,
  /** Medium quality with half-resolution AO balances smooth contact shading and cost. */
  AO_QUALITY: 'Medium' as const,
  AO_HALF_RES: true,
  AO_INTENSITY: 1.5,
  /** World-space contact radius (~board is ~10u); avoids edge-halo AO. */
  AO_RADIUS: 0.6,
  AO_DISTANCE_FALLOFF: 0.55,
  KEY_LIGHT_INTENSITY: 1.6,
  /** VSM gives softer penumbra than PCFSoft on directional lights (laptop-friendly blur). */
  SHADOW_MAP_TYPE: 'vsm' as const,
  SHADOW_MAP_SIZE: 2048,
  SHADOW_BIAS: -0.00004,
  SHADOW_NORMAL_BIAS: 0.0014,
  /** VSM blur passes (ignored for PCFSoft). */
  SHADOW_BLUR_SAMPLES: 12,
  SHADOW_RADIUS: 8,
  /** Tight ortho fit → more texels on playfield, less blocky penumbra. */
  SHADOW_FRUSTUM_EXPAND: 0.26,
  SHADOW_FRUSTUM_PAD_MIN: 0.42,
  SHADOW_FRUSTUM_PAD_XZ_RATIO: 0.085,
  /** Soft ivory daylight keeps avocado stone warm without yellow highlights. */
  KEY_LIGHT_COLOR: 0xfff4e5,
  /** Playfield / board / arena GLB albedo (light airy grey-green). */
  ENV: '#cbd0be',
  /** Fog + scene background (subtle vignette, still grey-green). */
  BACKDROP: '#d9dad3',
  /** Dark-theme environment albedo. */
  ENV_DARK: '#72716e',
  PIECE_LIGHT: '#e8e4dc',
  PIECE_DARK: '#4a4a48',
  MATERIAL_ROUGHNESS: 0.88,
  /** Slightly rougher ENV clay to avoid hot specular edges on large arena GLBs. */
  ENV_MATERIAL_ROUGHNESS: 0.93,
  /** Full-scene ShadowMaterial plane (PBR arenas use mesh receiveShadow instead). */
  USE_SCENE_SHADOW_CATCHER: false,
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
