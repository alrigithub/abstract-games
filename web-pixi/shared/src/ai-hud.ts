import {
  AI_STRENGTH_MAX,
  AI_STRENGTH_MIN,
  DEFAULT_AI_STRENGTH,
} from "./theme";

export type AiHudOptions = {
  depthEl: HTMLElement;
  decBtn: HTMLElement;
  incBtn: HTMLElement;
  min?: number;
  max?: number;
  initial?: number;
  onChange: (depth: number) => void;
};

/** Wire the fixed AI strength HUD (+/− and PageUp/PageDown). */
export function bindAiStrengthHud(opts: AiHudOptions): {
  getDepth: () => number;
  setDepth: (d: number) => void;
} {
  const min = opts.min ?? AI_STRENGTH_MIN;
  const max = opts.max ?? AI_STRENGTH_MAX;
  let depth = opts.initial ?? DEFAULT_AI_STRENGTH;

  const sync = () => {
    depth = Math.min(max, Math.max(min, depth));
    opts.depthEl.textContent = String(depth);
    opts.onChange(depth);
  };

  opts.decBtn.addEventListener("click", () => {
    depth -= 1;
    sync();
  });
  opts.incBtn.addEventListener("click", () => {
    depth += 1;
    sync();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "PageDown") opts.decBtn.click();
    if (e.key === "PageUp") opts.incBtn.click();
  });

  sync();
  return {
    getDepth: () => depth,
    setDepth: (d: number) => {
      depth = d;
      sync();
    },
  };
}
