import { describe, expect, it } from 'vitest';
import { AnimationQueue, motionDelay } from './animation-queue';

describe('AnimationQueue', () => {
  it('runs tasks one at a time in order', async () => {
    const q = new AnimationQueue();
    const log: number[] = [];
    const a = q.enqueue(async () => {
      log.push(1);
      await new Promise(r => setTimeout(r, 20));
      log.push(2);
    });
    const b = q.enqueue(async () => {
      log.push(3);
    });
    expect(q.busy).toBe(true);
    await Promise.all([a, b]);
    await q.drain();
    expect(log).toEqual([1, 2, 3]);
    expect(q.busy).toBe(false);
  });

  it('motionDelay is instant when reduced-motion is requested', async () => {
    const t0 = Date.now();
    await motionDelay(400, true);
    expect(Date.now() - t0).toBeLessThan(30);
  });

  it('continues after a rejected task', async () => {
    const q = new AnimationQueue();
    const log: string[] = [];
    q.enqueue(async () => {
      throw new Error('fail');
    }).catch(() => log.push('caught'));
    await q.enqueue(async () => {
      log.push('next');
    });
    await q.drain();
    expect(log).toContain('next');
  });
});
