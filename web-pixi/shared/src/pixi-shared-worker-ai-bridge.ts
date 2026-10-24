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

/** Main-thread client for a game-specific AI Web Worker. */
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
}
