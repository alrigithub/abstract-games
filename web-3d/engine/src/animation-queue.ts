/** Serializes animations so AI moves never overlap player motion. */
export class AnimationQueue {
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;

  enqueue(task: () => Promise<void>): Promise<void> {
    this.pending++;
    const run = this.chain.then(async () => {
      try {
        await task();
      } finally {
        this.pending--;
      }
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  get busy(): boolean {
    return this.pending > 0;
  }

  /** Wait until all queued work finishes (tests / AI handoff). */
  async drain(): Promise<void> {
    await this.chain;
  }
}
