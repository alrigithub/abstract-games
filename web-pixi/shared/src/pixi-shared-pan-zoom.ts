export type PanZoomState = {
  panX: number;
  panY: number;
  zoom: number;
};

export type PanZoomLimits = {
  minZoom?: number;
  maxZoom?: number;
};

const DEFAULT_LIMITS: Required<PanZoomLimits> = {
  minZoom: 0.45,
  maxZoom: 2.5,
};

/** Wheel + middle-button pan for a Pixi canvas. */
export class PixiPanZoomInput {
  private dragging = false;
  private dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
  private limits: Required<PanZoomLimits>;

  constructor(
    private canvas: HTMLCanvasElement,
    private state: PanZoomState,
    limits?: PanZoomLimits,
    private onChange?: () => void,
  ) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.bind();
  }

  private bind() {
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (e.ctrlKey) {
          const delta = e.deltaY > 0 ? 0.92 : 1.08;
          this.state.zoom = Math.min(
            this.limits.maxZoom,
            Math.max(this.limits.minZoom, this.state.zoom * delta),
          );
        } else {
          this.state.panX -= e.deltaX;
          this.state.panY -= e.deltaY;
        }
        this.onChange?.();
      },
      { passive: false },
    );

    this.canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 1 || e.buttons === 4 || e.shiftKey) {
        this.dragging = true;
        this.dragStart = {
          x: e.clientX,
          y: e.clientY,
          panX: this.state.panX,
          panY: this.state.panY,
        };
      }
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.state.panX = this.dragStart.panX + (e.clientX - this.dragStart.x);
      this.state.panY = this.dragStart.panY + (e.clientY - this.dragStart.y);
      this.onChange?.();
    });
    this.canvas.addEventListener("pointerup", () => {
      this.dragging = false;
    });
  }

  wasDragging(): boolean {
    return this.dragging;
  }
}
