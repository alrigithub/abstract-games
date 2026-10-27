/** Lucide-style inline SVG icons (stroke, 24×24 viewBox). */

const SVG_NS = 'http://www.w3.org/2000/svg';

const SCAN_EYE =
  '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="1"/><path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/>';

export type MenuIconName =
  | 'plus'
  | 'rotate-ccw'
  | 'maximize'
  | 'minimize'
  | 'arrow-left'
  | 'flip-vertical'
  | 'volume-2'
  | 'volume-x';

const PATHS: Record<MenuIconName, string> = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  'rotate-ccw':
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  maximize:
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minimize:
    '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'flip-vertical':
    '<path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="m4 12 4-4 4 4"/><path d="m16 12-4 4-4-4"/>',
  'volume-2':
    '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  'volume-x':
    '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
};

function createSvg(options: {
  className: string;
  size: number;
  strokeWidth: number;
  paths: string;
}): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', options.className);
  svg.setAttribute('width', String(options.size));
  svg.setAttribute('height', String(options.size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(options.strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = options.paths;
  return svg;
}

export function createMenuIcon(name: MenuIconName, _label: string): SVGSVGElement {
  return createSvg({ className: 'game-menu-icon', size: 16, strokeWidth: 2, paths: PATHS[name] });
}

/** Toolbar fullscreen control (Lucide maximize / minimize, stroke-width 1). */
export function createFullscreenToolbarIcon(expanded: boolean): SVGSVGElement {
  return createSvg({
    className: 'game-toolbar-icon',
    size: 18,
    strokeWidth: 1,
    paths: PATHS[expanded ? 'minimize' : 'maximize'],
  });
}

/** Toolbar camera control (Lucide scan-eye, stroke-width 1). */
export function createCameraToolbarIcon(): SVGSVGElement {
  return createSvg({
    className: 'game-toolbar-icon',
    size: 18,
    strokeWidth: 1,
    paths: SCAN_EYE,
  });
}

export function createActionIcon(name: MenuIconName): SVGSVGElement {
  return createSvg({ className: 'game-action-icon', size: 20, strokeWidth: 2, paths: PATHS[name] });
}
