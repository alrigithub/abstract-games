/** Named AI difficulty presets (depth + search budget). Games map these to their worker/heuristic. */
export interface AiStrengthLevel {
  id: string;
  label: string;
  maxDepth: number;
  maxNodes: number;
  /** Soft wall-clock budget for one search (ms). */
  timeBudgetMs: number;
}

export const DEFAULT_AI_STRENGTH_LEVELS: AiStrengthLevel[] = [
  { id: 'easy', label: 'Easy', maxDepth: 2, maxNodes: 4_000, timeBudgetMs: 400 },
  { id: 'medium', label: 'Medium', maxDepth: 4, maxNodes: 12_000, timeBudgetMs: 1_200 },
  { id: 'hard', label: 'Hard', maxDepth: 6, maxNodes: 28_000, timeBudgetMs: 3_000 },
  { id: 'expert', label: 'Expert', maxDepth: 8, maxNodes: 55_000, timeBudgetMs: 8_000 },
];

export interface AiStrengthSearchOptions {
  maxDepth: number;
  maxNodes: number;
  maxTimeMs: number;
}

export interface CreateAiStrengthControlOptions {
  /** Where to mount the control (appends a panel). */
  container: HTMLElement;
  /** localStorage key for level index. */
  storageKey: string;
  levels?: AiStrengthLevel[];
  /** Called after the level changes (including initial mount). */
  onChange?: (level: AiStrengthLevel, index: number) => void;
  /** Default level index when nothing stored (default: 1 = Medium). */
  defaultIndex?: number;
  /** `inline` = − / label / + row only (for shared game button bar). */
  layout?: 'panel' | 'inline';
}

export interface AiStrengthControl {
  getLevel(): AiStrengthLevel;
  getIndex(): number;
  setIndex(index: number): void;
  adjust(delta: number): void;
  readonly root: HTMLElement;
  destroy(): void;
}

export function readStoredAiStrengthIndex(storageKey: string, levelCount: number, fallback = 1): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return clampIndex(fallback, levelCount);
    const index = Number.parseInt(raw, 10);
    if (!Number.isFinite(index)) return clampIndex(fallback, levelCount);
    return clampIndex(index, levelCount);
  } catch {
    return clampIndex(fallback, levelCount);
  }
}

export function storeAiStrengthIndex(storageKey: string, index: number): void {
  try {
    localStorage.setItem(storageKey, String(index));
  } catch {
    /* storage disabled */
  }
}

function clampIndex(index: number, levelCount: number): number {
  return Math.max(0, Math.min(levelCount - 1, index));
}

export function levelToSearchOptions(level: AiStrengthLevel): AiStrengthSearchOptions {
  return {
    maxDepth: level.maxDepth,
    maxNodes: level.maxNodes,
    maxTimeMs: level.timeBudgetMs,
  };
}

export function createAiStrengthControl(options: CreateAiStrengthControlOptions): AiStrengthControl {
  const levels = options.levels ?? DEFAULT_AI_STRENGTH_LEVELS;
  let index = readStoredAiStrengthIndex(options.storageKey, levels.length, options.defaultIndex ?? 1);

  const layout = options.layout ?? 'panel';
  const root = document.createElement('div');
  root.className = layout === 'inline' ? 'ai-strength-inline' : 'ai-strength-control';
  root.dataset.testid = 'ai-strength';

  const title =
    layout === 'panel'
      ? (() => {
          const el = document.createElement('span');
          el.className = 'ai-strength-title';
          el.textContent = 'AI strength';
          return el;
        })()
      : null;

  const row = document.createElement('div');
  row.className = 'ai-strength-row';

  const dec = document.createElement('button');
  dec.type = 'button';
  dec.className = 'ai-strength-step';
  dec.dataset.testid = 'ai-strength-decrease';
  dec.setAttribute('aria-label', 'Decrease AI strength');
  dec.textContent = '−';

  const value = document.createElement('span');
  value.className = 'ai-strength-value';
  value.dataset.testid = 'ai-strength-label';

  const inc = document.createElement('button');
  inc.type = 'button';
  inc.className = 'ai-strength-step';
  inc.dataset.testid = 'ai-strength-increase';
  inc.setAttribute('aria-label', 'Increase AI strength');
  inc.textContent = '+';

  row.append(dec, value, inc);
  if (title) root.append(title, row);
  else root.append(row);
  options.container.append(root);

  const sync = () => {
    const level = levels[index]!;
    value.textContent = level.label;
    dec.disabled = index <= 0;
    inc.disabled = index >= levels.length - 1;
    root.dataset.aiLevel = level.id;
    root.dataset.aiDepth = String(level.maxDepth);
  };

  const apply = (next: number) => {
    index = clampIndex(next, levels.length);
    storeAiStrengthIndex(options.storageKey, index);
    sync();
    options.onChange?.(levels[index]!, index);
  };

  dec.addEventListener('click', () => apply(index - 1));
  inc.addEventListener('click', () => apply(index + 1));

  sync();

  return {
    getLevel: () => levels[index]!,
    getIndex: () => index,
    setIndex: apply,
    adjust: delta => apply(index + delta),
    root,
    destroy() {
      root.remove();
    },
  };
}

/** Suggested storage key for Gomoku web-3d (other games should use their own). */
export const GOMOKU_AI_STRENGTH_STORAGE_KEY = 'abstract-gomoku-ai-strength';

/** Suggested storage key for Tak web-3d. */
export const TAK_AI_STRENGTH_STORAGE_KEY = 'abstract-tak-ai-strength';

/** Suggested storage key for Boop web-3d. */
export const BOOP_AI_STRENGTH_STORAGE_KEY = 'abstract-boop-ai-strength';
