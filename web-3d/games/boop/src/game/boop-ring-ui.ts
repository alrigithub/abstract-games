import type { PieceKind } from './types';

/**
 * On-screen diameter of the control's authored 240px ring.
 * The SVG canvas is 256px so the drop shadow has room; the ring itself is 240.
 */
export const BOOP_CONTROL_RING_PX = 108;

/** Display size of control-big.svg / control-small.svg (256 source px). */
export const BOOP_CONTROL_ART_PX = BOOP_CONTROL_RING_PX * (256 / 240);

/**
 * Move-marker diameters at the same scale as the control ring.
 * Big is 204/240 of the control ring; small is 144/204 of big.
 * These stay constant in CSS pixels (screen overlay, not a ground disc).
 */
export const BOOP_MARKER_BIG_PX = BOOP_CONTROL_RING_PX * (204 / 240);
export const BOOP_MARKER_SMALL_PX = BOOP_MARKER_BIG_PX * (144 / 204);

export function boopMarkerDiameterPx(kind: PieceKind): number {
  return kind === 'cat' ? BOOP_MARKER_BIG_PX : BOOP_MARKER_SMALL_PX;
}

export function boopUiAsset(file: string): string {
  return `${import.meta.env.BASE_URL}ui/${file}`;
}
