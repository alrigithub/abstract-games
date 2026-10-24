import type { Container } from "pixi.js";

export type PanZoomLimits = {
  minZoom?: number;
  maxZoom?: number;
};

/** Pan (shift/middle-drag or scroll) and zoom (ctrl+wheel) for a Pixi world container. */
export class PanZoomController {
  panX = 0;
  panY = 0;
  zoom = 1;
  private dragging = false;
  private dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
  private limits: Required<PanZoomLimits>;

  constructor(limits: PanZoomLimits = {}) {
    this.limits = {
      minZoom: limits.minZoom ?? 0.45,
      maxZoom: limits.maxZoom ?? 2.5,
    };
  }

  attach(canvas: HTMLCanvasElement, onChange: () => void) {
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (e.ctrlKey) {
          const delta = e.deltaY > 0 ? 0.92 : 1.08;
          this.zoom = Math.min(
            this.limits.maxZoom,
            Math.max(this.limits.minZoom, this.zoom * delta),
          );
        } else {
          this.panX -= e.deltaX;
          this.panY -= e.deltaY;
        }
        onChange();
      },
      { passive: false },
    );

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 1 || e.buttons === 4 || e.shiftKey) {
        this.dragging = true;
        this.dragStart = {
          x: e.clientX,
          y: e.clientY,
          panX: this.panX,
          panY: this.panY,
        };
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.panX = this.dragStart.panX + (e.clientX - this.dragStart.x);
      this.panY = this.dragStart.panY + (e.clientY - this.dragStart.y);
      onChange();
    });
    canvas.addEventListener("pointerup", () => {
      this.dragging = false;
    });
  }

  wasDragging(): boolean {
    return this.dragging;
  }

  applyToWorld(world: Container, screenW: number, screenH: number) {
    world.scale.set(this.zoom);
    world.position.set(screenW / 2 + this.panX, screenH / 2 + this.panY);
  }
}
