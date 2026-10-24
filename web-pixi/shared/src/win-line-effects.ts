import { Container, Graphics } from "pixi.js";
import { theme } from "./theme";

export type Point2 = { x: number; y: number };

type Dust = {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  startAlpha: number;
};

/** Win-line glow + dust burst (shared by Yinsh scoring and Gomoku five-in-a-row). */
export class WinLineEffects extends Container {
  private glowLayer = new Container();
  private dustLayer = new Container();
  private dust: Dust[] = [];
  private pulseT = 0;
  private lingerMs = 0;
  private line: Point2[] = [];

  constructor() {
    super();
    this.addChild(this.glowLayer);
    this.addChild(this.dustLayer);
  }

  showLine(
    points: Point2[],
    opts: { haloRadius?: number; coreRadius?: number; factor?: number } = {},
  ) {
    const factor = opts.factor ?? 1;
    const haloR = (opts.haloRadius ?? 34) * factor;
    const coreR = (opts.coreRadius ?? 18) * factor;
    this.line = points;
    this.lingerMs = theme.scoreLingerMs;
    this.pulseT = 0;
    this.glowLayer.removeChildren();
    for (const p of points) {
      const halo = new Graphics();
      halo.circle(p.x, p.y, haloR).fill({ color: theme.win, alpha: 0.22 });
      const core = new Graphics();
      core.circle(p.x, p.y, coreR).fill({ color: theme.win, alpha: 0.45 });
      this.glowLayer.addChild(halo, core);
      this.spawnDust(p.x, p.y, factor);
    }
  }

  isLingering(): boolean {
    return this.lingerMs > 0;
  }

  private spawnDust(x: number, y: number, factor: number) {
    for (let i = 0; i < 16; i++) {
      const g = new Graphics();
      const r = 1.5 + Math.random() * 2.5;
      g.circle(0, 0, r * factor).fill({ color: theme.win, alpha: 0.7 });
      g.position.set(x, y);
      const angle = Math.random() * Math.PI * 2;
      const speed = (40 + Math.random() * 90) * factor;
      this.dustLayer.addChild(g);
      this.dust.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: theme.dustLifetimeMs,
        maxLife: theme.dustLifetimeMs,
        startAlpha: 0.55 + Math.random() * 0.35,
      });
    }
  }

  update(dtMs: number) {
    if (this.lingerMs > 0) {
      this.lingerMs -= dtMs;
      this.pulseT += dtMs / 1000;
      const blocking = this.lingerMs > 0;
      const amp = blocking ? 0.12 : 0.06;
      const hz = blocking ? 9 : 7;
      const scale = 1 + amp * Math.sin(this.pulseT * hz * Math.PI * 2);
      this.glowLayer.scale.set(scale);
    } else if (this.line.length) {
      this.line = [];
      this.glowLayer.removeChildren();
    }

    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.life -= dtMs;
      d.vx *= 0.96;
      d.vy *= 0.96;
      d.g.x += (d.vx * dtMs) / 1000;
      d.g.y += (d.vy * dtMs) / 1000;
      const t = Math.max(0, d.life / d.maxLife);
      d.g.alpha = d.startAlpha * t;
      if (d.life <= 0) {
        d.g.destroy();
        this.dust.splice(i, 1);
      }
    }
  }
}

/** @deprecated Use WinLineEffects — Yinsh alias kept for minimal diff. */
export class ScoreEffects extends WinLineEffects {
  showScoredLine(
    coords: Point2[],
    _spacing: number,
    factor: number,
  ) {
    this.showLine(coords, { factor });
  }
}
