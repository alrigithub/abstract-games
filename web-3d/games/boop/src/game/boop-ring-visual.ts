/** Shared Boop concentric ring visuals (control + placement marker). */

export const BOOP_RING_GREEN_TOP = '#314000';
export const BOOP_RING_GREEN_BOTTOM = '#B9FE8E';
export const BOOP_RING_GREY_TOP = '#8A8984';
export const BOOP_RING_GREY_BOTTOM = '#D4D2CC';
export const BOOP_RING_FACE_LIGHT_BOTTOM = '#D9D9D9';
export const BOOP_RING_FACE_GREY = '#E6E4DF';

export type BoopRingTone = 'active' | 'muted';

const GRADIENT_IDS = {
  greenStroke: 'boop-ring-green-stroke',
  greyStroke: 'boop-ring-grey-stroke',
  faceLight: 'boop-ring-face-light',
  faceGrey: 'boop-ring-face-grey',
} as const;

function ensureSvgDefs(doc: Document, svg: SVGSVGElement) {
  if (svg.querySelector('defs')) return;
  const defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');

  const greenStroke = doc.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  greenStroke.id = GRADIENT_IDS.greenStroke;
  greenStroke.setAttribute('x1', '0');
  greenStroke.setAttribute('y1', '0');
  greenStroke.setAttribute('x2', '0');
  greenStroke.setAttribute('y2', '1');
  for (const [offset, color] of [
    ['0%', BOOP_RING_GREEN_TOP],
    ['100%', BOOP_RING_GREEN_BOTTOM],
  ] as const) {
    const stop = doc.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    greenStroke.appendChild(stop);
  }

  const greyStroke = doc.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  greyStroke.id = GRADIENT_IDS.greyStroke;
  greyStroke.setAttribute('x1', '0');
  greyStroke.setAttribute('y1', '0');
  greyStroke.setAttribute('x2', '0');
  greyStroke.setAttribute('y2', '1');
  for (const [offset, color] of [
    ['0%', BOOP_RING_GREY_TOP],
    ['100%', BOOP_RING_GREY_BOTTOM],
  ] as const) {
    const stop = doc.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    greyStroke.appendChild(stop);
  }

  const faceLight = doc.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  faceLight.id = GRADIENT_IDS.faceLight;
  faceLight.setAttribute('x1', '0');
  faceLight.setAttribute('y1', '0');
  faceLight.setAttribute('x2', '0');
  faceLight.setAttribute('y2', '1');
  for (const [offset, color, opacity] of [
    ['0%', '#ffffff', '0.55'],
    ['55%', '#ffffff', '0.55'],
    ['100%', BOOP_RING_FACE_LIGHT_BOTTOM, '1'],
  ] as const) {
    const stop = doc.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    stop.setAttribute('stop-opacity', opacity);
    faceLight.appendChild(stop);
  }

  const faceGrey = doc.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  faceGrey.id = GRADIENT_IDS.faceGrey;
  faceGrey.setAttribute('x1', '0');
  faceGrey.setAttribute('y1', '0');
  faceGrey.setAttribute('x2', '0');
  faceGrey.setAttribute('y2', '1');
  for (const [offset, color] of [
    ['0%', BOOP_RING_FACE_GREY],
    ['100%', BOOP_RING_FACE_GREY],
  ] as const) {
    const stop = doc.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    faceGrey.appendChild(stop);
  }

  defs.append(greenStroke, greyStroke, faceLight, faceGrey);
  svg.prepend(defs);
}

export interface BoopRingCircleOptions {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  tone: BoopRingTone;
}

export function appendRingCircle(svg: SVGSVGElement, options: BoopRingCircleOptions): SVGCircleElement {
  ensureSvgDefs(document, svg);
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', String(options.cx));
  circle.setAttribute('cy', String(options.cy));
  circle.setAttribute('r', String(options.r));
  circle.setAttribute('fill', options.tone === 'active' ? `url(#${GRADIENT_IDS.faceLight})` : `url(#${GRADIENT_IDS.faceGrey})`);
  circle.setAttribute('stroke', options.tone === 'active' ? `url(#${GRADIENT_IDS.greenStroke})` : `url(#${GRADIENT_IDS.greyStroke})`);
  circle.setAttribute('stroke-width', String(options.strokeWidth));
  svg.appendChild(circle);
  return circle;
}

/** Marker stroke width in px for a given on-screen ring diameter. */
export function boopMarkerStrokePx(diameterPx: number, isBig: boolean): number {
  const ref = isBig ? 156 : 96;
  const stroke = isBig ? 13 : 9;
  return Math.max(2, (diameterPx / ref) * stroke);
}

/** Extra halo radius beyond the ring outer edge (px). */
export function boopMarkerHaloExtraRadiusPx(diameterPx: number, isBig: boolean): number {
  const ref = isBig ? 156 : 96;
  return (diameterPx / ref) * 20;
}
