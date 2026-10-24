export { PIXI_PALETTE } from "./palette";
export {
  theme,
  AI_STRENGTH_MIN,
  AI_STRENGTH_MAX,
  DEFAULT_AI_STRENGTH,
} from "./theme";
import { PIXI_PALETTE } from "./palette";
import { theme } from "./theme";

/** Alias matching Tak / legacy imports (`palette.selectionGlow`). */
export const palette = {
  ...PIXI_PALETTE,
  selectionGlow: theme.selectionGlow,
};

export {
  applyPan,
  applyZoomAt,
  clampZoom,
  fitCamera,
  screenToWorld,
  worldToScreen,
  applyCameraToContainer,
  DEFAULT_CAMERA_LIMITS,
  type CameraLimits,
  type CameraState,
} from "./camera";
export { cellIndex, nearestCell, nearestIntersection } from "./hit";
export {
  shouldStartPanOnPointerDown,
  isPinchZoomWheel,
  isTrackpadPanWheel,
} from "./pointer-input";
export { safeDestroyApplication } from "./destroy-application";
export { createPixiStage, type PixiStageApi, type CreatePixiStageOptions } from "./stage";
export { attachPixiStageInput, type StageInputOptions } from "./stage-input";
export { AnimatedBackground } from "./animated-background";
export {
  WinLineEffects,
  ScoreEffects,
  type Point2,
} from "./win-line-effects";
export { WinEffects, type EffectCoord, type ScreenPointFn } from "./win-effects";
export { PanZoomController } from "./pan-zoom";
export {
  drawHoverRing,
  drawSelectionPulse,
  drawLegalTarget,
} from "./indicators";
export { bindAiStrengthHud, type AiHudOptions } from "./ai-hud";
export {
  attachAiWorkerBridge,
  createAiWorkerBridge,
  PixiWorkerAiBridge,
  AiWorkerClient,
  type AiWorkerBridge,
  type AiWorkerRequest,
  type AiWorkerResponse,
} from "./ai-worker-bridge";
export { drawHexBoard } from "./hex-grid";
export {
  type Coord,
  type HexLayout,
  coordKey,
  screenPoint,
  spacingForViewport,
  boardOrigin,
  nearestCoord,
  DEFAULT_PICK_RADIUS_FACTOR,
} from "./hex-layout";
