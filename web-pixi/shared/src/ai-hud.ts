import {
  AI_STRENGTH_MAX,
  AI_STRENGTH_MIN,
  DEFAULT_AI_STRENGTH,
} from "./theme";

export type AiHudOptions = {
  depthEl: HTMLElement;
  decBtn: HTMLElement;
  incBtn: HTMLElement;
  onDepthChange: (depth: number) => void;
  min?: number;
  max?: number;
  initial?: number;
};

/** Wire − / + AI strength controls (PageUp/PageDown shortcuts). */
export function bindAiStrengthHud(opts: AiHudOptions): () => number {
  const min = opts.min ?? AI_STRENGTH_MIN;
  const max = opts.max ?? AI_STRENGTH_MAX;
  let depth = opts.initial ?? DEFAULT_AI_STRENGTH;
  opts.depthEl.textContent = String(depth);
  opts.onDepthChange(depth);

  const dec = () => {
    depth = Math.max(min, depth - 1);
    opts.depthEl.textContent = String(depth);
    opts.onDepthChange(depth);
  };
  const inc = () => {
    depth = Math.min(max, depth + 1);
    opts.depthEl.textContent = String(depth);
    opts.onDepthChange(depth);
  };

  opts.decBtn.addEventListener("click", dec);
  opts.incBtn.addEventListener("click", inc);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "PageDown") dec();
    if (e.key === "PageUp") inc();
  };
  window.addEventListener("keydown", onKey);

  return () => depth;
}
