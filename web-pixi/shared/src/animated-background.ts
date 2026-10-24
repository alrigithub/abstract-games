import { Container, Graphics } from "pixi.js";
import { theme } from "./theme";

/** Soft drifting blobs on the stage (light theme). */
export class AnimatedBackground extends Container {
  private g = new Graphics();
  private t = 0;

  constructor() {
    super();
    this.addChild(this.g);
  }

  update(dt: number, w: number, h: number) {
    this.t += dt;
    this.g.clear();
    this.g.rect(0, 0, w, h).fill({ color: theme.stageBg });

    const blobs = [
      { cx: 0.25, cy: 0.3, r: 0.35, hue: theme.boardFill, a: 0.35 },
      { cx: 0.75, cy: 0.65, r: 0.28, hue: theme.boardFill, a: 0.28 },
      { cx: 0.55, cy: 0.2, r: 0.22, hue: theme.hover, a: 0.12 },
    ];

    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i]!;
      const ox = Math.sin(this.t * 0.15 + i * 1.7) * w * 0.04;
      const oy = Math.cos(this.t * 0.12 + i * 2.1) * h * 0.04;
      const cx = b.cx * w + ox;
      const cy = b.cy * h + oy;
      const r = b.r * Math.min(w, h);
      this.g.circle(cx, cy, r).fill({ color: b.hue, alpha: b.a });
    }
  }
}
