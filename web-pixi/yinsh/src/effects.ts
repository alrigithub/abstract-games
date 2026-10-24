import { Container, Graphics } from "pixi.js";
import type { Coord } from "./coords";
import { screenPoint } from "./coords";
import { theme } from "./theme";

type Dust = {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  startAlpha: number;
};

export class ScoreEffects extends Container {
  private glowLayer = new Container();
  private dustLayer = new Container();
  private dust: Dust[] = [];
  private pulseT = 0;
  private lingerMs = 0;
  private line: Coord[] = [];

  constructor() {
    super();
    this.addChild(this.glowLayer);
    this.addChild(this.dustLayer);
  }

  showScoredLine(coords: Coord[], spacing: number, factor: number) {
    this.line = coords;
    this.lingerMs = theme.scoreLingerMs;
    this.pulseT = 0;
    this.glowLayer.removeChildren();
    for (const c of coords) {
      const p = screenPoint(c, spacing);
      const halo = new Graphics();
      halo.circle(p.x, p.y, 34 * factor).fill({ color: theme.win, alpha: 0.22 });
      const core = new Graphics();
      core.circle(p.x, p.y, 18 * factor).fill({ color: theme.win, alpha: 0.45 });
      this.glowLayer.addChild(halo, core);
      this.spawnDust(p.x, p.y, factor);
    }
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

  update(dtMs: number, spacing: number, factor: number) {
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
    void spacing;
    void factor;
  }
}
