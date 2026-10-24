export type AiWorkerRequest = {
  id: number;
  stateJson: string;
  depth: number;
};

export type AiWorkerResponse = {
  id: number;
  moveJson: string;
  error?: string;
};

export type AiWorkerBridge = {
  worker: Worker;
  post: (req: AiWorkerRequest) => void;
  setHandler: (fn: (resp: AiWorkerResponse) => void) => void;
  dispose: () => void;
};

export function attachAiWorkerBridge(worker: Worker): AiWorkerBridge {
  let handler: ((resp: AiWorkerResponse) => void) | null = null;

  worker.onmessage = (ev: MessageEvent<AiWorkerResponse>) => {
    handler?.(ev.data);
  };

  return {
    worker,
    post: (req) => worker.postMessage(req),
    setHandler: (fn) => {
      handler = fn;
    },
    dispose: () => worker.terminate(),
  };
}

export function createAiWorkerBridge(workerModuleUrl: URL): AiWorkerBridge {
  return attachAiWorkerBridge(
    new Worker(workerModuleUrl, { type: "module" }),
  );
}

/** Promise-based AI worker client (WASM / heuristic workers using `moveJson`). */
export class PixiWorkerAiBridge {
  private worker: Worker;
  private reqId = 0;
  private pendingId: number | null = null;
  private onResult: ((moveJson: string, error?: string) => void) | null = null;

  constructor(workerUrl: URL) {
    this.worker = new Worker(workerUrl, { type: "module" });
    this.worker.onmessage = (ev: MessageEvent<AiWorkerResponse>) => {
      const { id, moveJson, error } = ev.data;
      if (this.pendingId !== id) return;
      this.pendingId = null;
      this.onResult?.(moveJson, error);
      this.onResult = null;
    };
  }

  get thinking(): boolean {
    return this.pendingId !== null;
  }

  requestMove(
    stateJson: string,
    depth: number,
  ): Promise<{ moveJson: string; error?: string }> {
    if (this.pendingId !== null) {
      return Promise.reject(new Error("AI already thinking"));
    }
    const id = ++this.reqId;
    this.pendingId = id;
    return new Promise((resolve) => {
      this.onResult = (moveJson, error) => resolve({ moveJson, error });
      const msg: AiWorkerRequest = { id, stateJson, depth };
      this.worker.postMessage(msg);
    });
  }

  dispose() {
    this.worker.terminate();
  }
}

/** @deprecated Use `PixiWorkerAiBridge` — kept for Tzaar port call sites. */
export class AiWorkerClient {
  private inner: PixiWorkerAiBridge;

  constructor(workerUrl: URL) {
    this.inner = new PixiWorkerAiBridge(workerUrl);
  }

  isBusy(): boolean {
    return this.inner.thinking;
  }

  requestMove(
    stateJson: string,
    depth: number,
  ): Promise<AiWorkerResponse> {
    return this.inner.requestMove(stateJson, depth).then(({ moveJson, error }) => ({
      id: 0,
      moveJson,
      error,
    }));
  }

  dispose() {
    this.inner.dispose();
  }
}
