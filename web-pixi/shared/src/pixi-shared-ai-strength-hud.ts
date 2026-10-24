import {
  AI_STRENGTH_MAX,
  AI_STRENGTH_MIN,
  DEFAULT_AI_STRENGTH,
} from "./pixi-stage/palette";

export type AiStrengthHud = {
  depth: number;
  setDepth: (n: number) => void;
};

export function wireAiStrengthHud(
  options: {
    depthEl: HTMLElement;
    decBtn: HTMLElement;
    incBtn: HTMLElement;
    min?: number;
    max?: number;
    initial?: number;
    onChange: (depth: number) => void;
  },
): AiStrengthHud {
  const min = options.min ?? AI_STRENGTH_MIN;
  const max = options.max ?? AI_STRENGTH_MAX;
  let depth = options.initial ?? DEFAULT_AI_STRENGTH;
  depth = Math.min(max, Math.max(min, depth));
  options.depthEl.textContent = String(depth);
  options.onChange(depth);

  const setDepth = (n: number) => {
    depth = Math.min(max, Math.max(min, n));
    options.depthEl.textContent = String(depth);
    options.onChange(depth);
  };

  options.decBtn.addEventListener("click", () => setDepth(depth - 1));
  options.incBtn.addEventListener("click", () => setDepth(depth + 1));

  window.addEventListener("keydown", (e) => {
    if (e.key === "PageDown") options.decBtn.click();
    if (e.key === "PageUp") options.incBtn.click();
  });

  return {
    get depth() {
      return depth;
    },
    setDepth,
  };
}
