import { pxPerWorldUnit, type SceneApi, type ThemeId } from '@abstract/three-engine';
import {
  appendRingCircle,
  boopMarkerHaloExtraRadiusPx,
  boopMarkerStrokePx,
} from './boop-ring-visual';
import type { PieceKind } from './types';

export interface BoopPlacementGhostOptions {
  testId?: string;
  theme?: ThemeId;
}

/**
 * Board placement preview: green gradient ring at piece footprint, faint vase ghost, soft halo.
 */
export class BoopPlacementGhost {
  private readonly root: HTMLDivElement;
  private readonly halo: HTMLDivElement;
  private readonly ringHost: HTMLDivElement;
  private readonly ringSvg: SVGSVGElement;
  private readonly vase: HTMLDivElement;
  private visible = false;
  private kind: PieceKind = 'kitten';

  constructor(board: HTMLElement, options: BoopPlacementGhostOptions = {}) {
    this.root = document.createElement('div');
    this.root.className = 'boop-placement-ghost';
    if (options.testId) this.root.dataset.testid = options.testId;

    this.halo = document.createElement('div');
    this.halo.className = 'boop-placement-ghost__halo';

    this.ringHost = document.createElement('div');
    this.ringHost.className = 'boop-placement-ghost__ring';

    this.ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.ringSvg.setAttribute('class', 'boop-placement-ghost__ring-svg');
    this.ringSvg.setAttribute('viewBox', '0 0 100 100');
    this.ringSvg.setAttribute('aria-hidden', 'true');
    this.ringHost.appendChild(this.ringSvg);

    this.vase = document.createElement('div');
    this.vase.className = 'boop-placement-ghost__vase';

    this.root.append(this.halo, this.ringHost, this.vase);
    this.root.hidden = true;
    board.appendChild(this.root);
    if (options.theme) this.applyTheme(options.theme);
  }

  applyTheme(theme: ThemeId) {
    this.root.dataset.theme = theme;
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.root.hidden = true;
  }

  showAt(
    scene: SceneApi,
    board: HTMLElement,
    cellIndex: number,
    diameterWorldUnits: number,
    cellIndexFn: (row: number, col: number) => number,
    kind: PieceKind,
  ) {
    this.kind = kind;
    const center = scene.cellScreen(cellIndex);
    const boardRect = board.getBoundingClientRect();
    const pxPerUnit = pxPerWorldUnit(scene, cellIndexFn);
    const diameterPx = diameterWorldUnits * pxPerUnit;
    const isBig = kind === 'cat';
    const strokePx = boopMarkerStrokePx(diameterPx, isBig);
    const haloExtra = boopMarkerHaloExtraRadiusPx(diameterPx, isBig);
    const outerRadiusPx = diameterPx / 2;
    const haloDiameterPx = (outerRadiusPx + haloExtra) * 2;

    this.root.style.left = `${center.x - boardRect.left}px`;
    this.root.style.top = `${center.y - boardRect.top}px`;
    this.root.style.width = `${diameterPx}px`;
    this.root.style.height = `${diameterPx}px`;
    this.root.dataset.kind = kind;

    this.halo.style.width = `${haloDiameterPx}px`;
    this.halo.style.height = `${haloDiameterPx}px`;

    const innerRadiusNorm = Math.max(8, 50 - (strokePx / diameterPx) * 50);
    this.ringSvg.replaceChildren();
    appendRingCircle(this.ringSvg, {
      cx: 50,
      cy: 50,
      r: innerRadiusNorm,
      strokeWidth: (strokePx / diameterPx) * 100,
      tone: 'active',
    });

    const vaseDiameter = diameterPx * 0.5;
    this.vase.style.width = `${vaseDiameter}px`;
    this.vase.style.height = `${vaseDiameter}px`;

    this.root.hidden = false;
    this.visible = true;
  }
}
