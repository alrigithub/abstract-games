/** Hard main-thread watchdog slack after the search time budget (worker teardown). */
export const AI_WORKER_TIMEOUT_SLACK_MS = 300;

export interface AiWorkerRequestOptions<TResult> {
  createWorker: () => Worker;
  postMessage: (worker: Worker, requestId: number) => void;
  parseMessage: (event: MessageEvent, requestId: number) => TResult | undefined;
  /** Search soft budget (ms); watchdog uses this + {@link AI_WORKER_TIMEOUT_SLACK_MS}. */
  timeBudgetMs: number;
}

/**
 * One in-flight AI worker with generation guards and a hard main-thread timeout.
 * Terminates the worker on completion, error, cancel, or watchdog.
 */
export class AiWorkerSession {
  private worker: Worker | null = null;
  private generation = 0;

  cancel(): void {
    this.generation++;
    this.terminateWorker();
  }

  getGeneration(): number {
    return this.generation;
  }

  request<T>(options: AiWorkerRequestOptions<T>): Promise<T | undefined> {
    const requestId = ++this.generation;
    const hardTimeoutMs = Math.max(200, options.timeBudgetMs + AI_WORKER_TIMEOUT_SLACK_MS);

    return new Promise(resolve => {
      let settled = false;
      const finish = (value: T | undefined) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        if (requestId === this.generation) this.terminateWorker();
        resolve(value);
      };

      this.terminateWorker();
      let worker: Worker;
      try {
        worker = options.createWorker();
      } catch {
        finish(undefined);
        return;
      }
      this.worker = worker;

      const timer = globalThis.setTimeout(() => {
        this.terminateWorker();
        finish(undefined);
      }, hardTimeoutMs);

      worker.onmessage = (event: MessageEvent) => {
        if (requestId !== this.generation) return;
        finish(options.parseMessage(event, requestId));
      };
      worker.onerror = () => finish(undefined);

      try {
        options.postMessage(worker, requestId);
      } catch {
        finish(undefined);
      }
    });
  }

  private terminateWorker(): void {
    if (this.worker && typeof this.worker.terminate === 'function') {
      this.worker.terminate();
    }
    this.worker = null;
  }
}

export function aiWatchdogMs(timeBudgetMs: number): number {
  return Math.max(200, timeBudgetMs + AI_WORKER_TIMEOUT_SLACK_MS);
}

/** Exposed on `document.body` for e2e perf / stall checks. */
export function recordAiThinkMetrics(elapsedMs: number): void {
  if (typeof document === 'undefined') return;
  const ms = Math.round(elapsedMs);
  document.body.dataset.lastAiThinkMs = String(ms);
  const prev = Number.parseInt(document.body.dataset.maxAiThinkMs ?? '0', 10);
  if (ms > prev) document.body.dataset.maxAiThinkMs = String(ms);
}
