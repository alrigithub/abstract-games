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

/** Minimal Web Worker bridge for WASM `ai_best_move`. */
export class AiWorkerClient {
  private worker: Worker;
  private reqId = 0;
  private pendingId: number | null = null;
  private onResult: ((resp: AiWorkerResponse) => void) | null = null;

  constructor(workerUrl: URL) {
    this.worker = new Worker(workerUrl, { type: "module" });
    this.worker.onmessage = (ev: MessageEvent<AiWorkerResponse>) => {
      const data = ev.data;
      if (this.pendingId !== data.id) return;
      this.pendingId = null;
      this.onResult?.(data);
      this.onResult = null;
    };
  }

  isBusy(): boolean {
    return this.pendingId !== null;
  }

  requestMove(
    stateJson: string,
    depth: number,
  ): Promise<AiWorkerResponse> {
    if (this.pendingId !== null) {
      return Promise.reject(new Error("AI worker busy"));
    }
    const id = ++this.reqId;
    this.pendingId = id;
    return new Promise((resolve) => {
      this.onResult = resolve;
      const msg: AiWorkerRequest = { id, stateJson, depth };
      this.worker.postMessage(msg);
    });
  }

  terminate() {
    this.worker.terminate();
  }
}
