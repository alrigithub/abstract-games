import { easeOutBack, easeOutCubic } from "./easing.ts";

export type EaseKind = "outCubic" | "outBack" | "linear";

export interface TweenSpec {
  from: number;
  to: number;
  durationMs: number;
  delayMs?: number;
  ease?: EaseKind;
  onUpdate: (value: number) => void;
}

export interface TimelineStep {
  tweens: TweenSpec[];
  label?: string;
}

interface RunningTween extends TweenSpec {
  startedAt: number;
}

export interface SchedulerOptions {
  now?: () => number;
}

/**
 * Interruptible tween queue driven by an external ticker (Pixi `ticker.deltaMS`).
 * One timeline runs at a time; further timelines wait in FIFO order.
 */
export class TweenScheduler {
  private readonly now: () => number;
  private queue: Array<{ step: TimelineStep; resolve: () => void }> = [];
  private active: RunningTween[] = [];
  private running = false;

  constructor(options: SchedulerOptions = {}) {
    this.now = options.now ?? (() => performance.now());
  }

  get busy(): boolean {
    return this.running || this.queue.length > 0;
  }

  enqueue(step: TimelineStep): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ step, resolve });
      this.pump();
    });
  }

  interrupt(): void {
    for (const t of this.active) t.onUpdate(t.to);
    this.active = [];
    this.running = false;
    for (const item of this.queue) item.resolve();
    this.queue = [];
  }

  tick(_deltaMs: number): void {
    if (!this.running && this.queue.length) this.startNext();
    if (!this.running) return;

    const t0 = this.now();
    let anyActive = false;
    for (const tween of this.active) {
      const delay = tween.delayMs ?? 0;
      const elapsed = t0 - tween.startedAt - delay;
      if (elapsed < 0) {
        anyActive = true;
        continue;
      }
      const u = Math.min(1, elapsed / tween.durationMs);
      const eased = applyEase(u, tween.ease ?? "outCubic");
      tween.onUpdate(tween.from + (tween.to - tween.from) * eased);
      if (u < 1) anyActive = true;
    }
    if (!anyActive) this.finishCurrent();
  }

  private pump(): void {
    if (!this.running && this.queue.length) this.startNext();
  }

  private startNext(): void {
    const item = this.queue.shift();
    if (!item) return;
    this.running = true;
    const startedAt = this.now();
    this.active = item.step.tweens.map((t) => ({ ...t, startedAt }));
    this.pendingResolve = item.resolve;
  }

  private pendingResolve: (() => void) | null = null;

  private finishCurrent(): void {
    this.active = [];
    this.running = false;
    this.pendingResolve?.();
    this.pendingResolve = null;
    if (this.queue.length) this.startNext();
  }
}

function applyEase(t: number, kind: EaseKind): number {
  switch (kind) {
    case "outBack":
      return easeOutBack(t);
    case "linear":
      return t;
    default:
      return easeOutCubic(t);
  }
}
