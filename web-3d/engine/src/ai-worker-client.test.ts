import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_WORKER_TIMEOUT_SLACK_MS, AiWorkerSession, aiWatchdogMs } from './ai-worker-client';

describe('AiWorkerSession', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves undefined when postMessage throws', async () => {
    const session = new AiWorkerSession();
    const result = await session.request({
      createWorker: () => ({}) as Worker,
      postMessage: () => {
        throw new Error('fail');
      },
      parseMessage: () => 'ok',
      timeBudgetMs: 100,
    });
    expect(result).toBeUndefined();
  });

  it('cancel bumps generation so late messages are ignored', async () => {
    vi.useFakeTimers();
    const session = new AiWorkerSession();
    let handler: ((event: MessageEvent) => void) | null = null;
    const worker = {
      terminate: vi.fn(),
      set onmessage(fn: (event: MessageEvent) => void) {
        handler = fn;
      },
      set onerror(_fn: () => void) {},
    } as unknown as Worker;

    const pending = session.request({
      createWorker: () => worker,
      postMessage: () => {},
      parseMessage: () => 'late',
      timeBudgetMs: 500,
    });

    session.cancel();
    handler?.({ data: {} } as MessageEvent);
    vi.advanceTimersByTime(aiWatchdogMs(500) + 10);

    await expect(pending).resolves.toBeUndefined();
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('watchdog adds slack to budget', () => {
    expect(aiWatchdogMs(400)).toBe(400 + AI_WORKER_TIMEOUT_SLACK_MS);
  });
});
