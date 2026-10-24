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

export function createAiWorkerBridge(workerModuleUrl: URL): AiWorkerBridge {
  const worker = new Worker(workerModuleUrl, { type: "module" });
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
