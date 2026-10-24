export type CameraState = { x: number; y: number; zoom: number }
export type CameraLimits = { minZoom: number; maxZoom: number }

export const DEFAULT_CAMERA_LIMITS: CameraLimits = {
  minZoom: 0.4,
  maxZoom: 4,
}

export function clampZoom(zoom: number, limits: CameraLimits): number {
  return Math.min(limits.maxZoom, Math.max(limits.minZoom, zoom))
}

export function applyPan(
  state: CameraState,
  dx: number,
  dy: number
): CameraState {
  return {
    x: state.x + dx / state.zoom,
    y: state.y + dy / state.zoom,
    zoom: state.zoom,
  }
}

export function applyZoomAt(
  state: CameraState,
  worldX: number,
  worldY: number,
  factor: number,
  limits: CameraLimits
): CameraState {
  const nextZoom = clampZoom(state.zoom * factor, limits)
  if (nextZoom === state.zoom) return state
  const screenOffsetX = (worldX - state.x) * state.zoom
  const screenOffsetY = (worldY - state.y) * state.zoom
  const nextX = worldX - screenOffsetX / nextZoom
  const nextY = worldY - screenOffsetY / nextZoom
  return { x: nextX, y: nextY, zoom: nextZoom }
}

export function fitCamera(
  bounds: { width: number; height: number },
  viewport: { width: number; height: number },
  fill = 0.9
): CameraState {
  const vw = Math.max(1, viewport.width)
  const vh = Math.max(1, viewport.height)
  const zoom = (fill * Math.min(vw, vh)) / Math.max(bounds.width, bounds.height, 1)
  return { x: 0, y: 0, zoom }
}

export function screenToWorld(
  state: CameraState,
  screenX: number,
  screenY: number,
  viewport: { width: number; height: number }
): { x: number; y: number } {
  return {
    x: state.x + (screenX - viewport.width / 2) / state.zoom,
    y: state.y + (screenY - viewport.height / 2) / state.zoom,
  }
}

export function worldToScreen(
  state: CameraState,
  worldX: number,
  worldY: number,
  viewport: { width: number; height: number }
): { x: number; y: number } {
  return {
    x: viewport.width / 2 + (worldX - state.x) * state.zoom,
    y: viewport.height / 2 + (worldY - state.y) * state.zoom,
  }
}

export function applyCameraToContainer(
  world: { position: { set: (x: number, y: number) => void }; scale: { set: (s: number) => void } },
  state: CameraState,
  viewport: { width: number; height: number }
): void {
  world.scale.set(state.zoom)
  world.position.set(
    viewport.width / 2 - state.x * state.zoom,
    viewport.height / 2 - state.y * state.zoom
  )
}
