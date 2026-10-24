import { describe, expect, it, vi } from "vitest";
import { TweenScheduler } from "./scheduler.ts";

describe("TweenScheduler", () => {
  it("runs tweens in order and resolves enqueue", async () => {
    let now = 0;
    const scheduler = new TweenScheduler({ now: () => now });
    const values: number[] = [];
    const p = scheduler.enqueue({
      tweens: [
        {
          from: 0,
          to: 10,
          durationMs: 100,
          onUpdate: (v) => values.push(Math.round(v)),
        },
      ],
    });
    now = 50;
    scheduler.tick(16);
    now = 100;
    scheduler.tick(16);
    await p;
    expect(values.at(-1)).toBe(10);
  });

  it("queues timelines without overlap", async () => {
    let now = 0;
    const scheduler = new TweenScheduler({ now: () => now });
    const log: string[] = [];
    const first = scheduler.enqueue({
      label: "a",
      tweens: [
        {
          from: 0,
          to: 1,
          durationMs: 100,
          onUpdate: () => log.push("a"),
        },
      ],
    });
    const second = scheduler.enqueue({
      label: "b",
      tweens: [
        {
          from: 0,
          to: 1,
          durationMs: 50,
          onUpdate: () => log.push("b"),
        },
      ],
    });
    now = 100;
    scheduler.tick(16);
    await first;
    now = 150;
    scheduler.tick(16);
    await second;
    expect(log.filter((x) => x === "b").length).toBeGreaterThan(0);
  });

  it("interrupt snaps to end values", () => {
    let now = 0;
    const scheduler = new TweenScheduler({ now: () => now });
    let v = 0;
    void scheduler.enqueue({
      tweens: [{ from: 0, to: 5, durationMs: 200, onUpdate: (x) => (v = x) }],
    });
    now = 20;
    scheduler.tick(16);
    scheduler.interrupt();
    expect(v).toBe(5);
  });
});
