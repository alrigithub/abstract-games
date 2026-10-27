import { boopMarkerDiameterPx, boopUiAsset } from './boop-ring-ui';
import type { PieceKind } from './types';

/**
 * Screen-facing move marker. Fixed CSS diameter (see boop-ring-ui).
 * Position is only `transform: translate3d` so hops do not read or write layout.
 * A hop eases with time constant {@link BOOP_MARKER_HOP_TAU_MS}; camera moves
 * of the same cell snap so the ring stays on the cell centre.
 */
export const BOOP_MARKER_HOP_TAU_MS = 75;

export class BoopScreenMarker {
  private readonly el: HTMLDivElement;
  private readonly img: HTMLImageElement;
  private readonly reduced: boolean;
  private kind: PieceKind | null = null;
  private half = 0;
  private x = 0;
  private y = 0;
  private easing = false;
  private visible = false;
  private lastNow = 0;

  constructor(board: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'boop-move-marker';
    this.el.dataset.testid = 'boop-placement-ghost';
    this.el.hidden = true;
    this.el.style.left = '0px';
    this.el.style.top = '0px';
    this.img = document.createElement('img');
    this.img.alt = '';
    this.img.draggable = false;
    this.el.append(this.img);
    board.append(this.el);
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  isGliding(): boolean {
    return this.easing;
  }

  hide() {
    if (!this.visible && this.el.hidden) return;
    this.visible = false;
    this.easing = false;
    this.el.hidden = true;
  }

  /**
   * `x`/`y` are board-local pixels of the cell centre.
   * `hop` eases from the previous centre; otherwise the marker sits on the target.
   */
  glideTo(x: number, y: number, kind: PieceKind, now: number, hop: boolean) {
    this.applyKind(kind);
    if (!this.visible || this.reduced) {
      this.x = x;
      this.y = y;
      this.easing = false;
    } else if (hop || this.easing) {
      if (hop && !this.easing) this.lastNow = now;
      this.easing = true;
      const dt = Math.max(0, now - this.lastNow);
      const alpha = 1 - Math.exp(-dt / BOOP_MARKER_HOP_TAU_MS);
      this.x += (x - this.x) * alpha;
      this.y += (y - this.y) * alpha;
      const dx = x - this.x;
      const dy = y - this.y;
      if (dx * dx + dy * dy < 0.16) {
        this.x = x;
        this.y = y;
        this.easing = false;
      }
    } else {
      this.x = x;
      this.y = y;
    }
    this.lastNow = now;
    this.visible = true;
    this.el.hidden = false;
    this.el.dataset.kind = kind;
    this.writeTransform();
  }

  private applyKind(kind: PieceKind) {
    if (this.kind === kind) return;
    this.kind = kind;
    const diameter = boopMarkerDiameterPx(kind);
    this.half = diameter / 2;
    this.img.src = boopUiAsset(kind === 'cat' ? 'marker-big.svg' : 'marker-small.svg');
    this.img.width = kind === 'cat' ? 204 : 144;
    this.img.height = kind === 'cat' ? 204 : 144;
    this.el.style.width = `${diameter}px`;
    this.el.style.height = `${diameter}px`;
  }

  private writeTransform() {
    this.el.style.transform = `translate3d(${this.x - this.half}px, ${this.y - this.half}px, 0)`;
  }
}
