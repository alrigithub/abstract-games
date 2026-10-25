/**
 * Full-screen startup overlay shared by every 3D game. Matches hub lobby typography
 * (system-ui) and dark clay-adjacent palette; shows step labels, progress, and errors.
 */

const OVERLAY_ID = 'abstract-loading-overlay';
const STYLE_ID = 'abstract-loading-screen-styles';
const HISTORY_LIMIT = 8;

/** Hub-aligned tokens (see web-3d/hub/index.html). */
const LOADING_CSS = `
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: hsl(0, 0%, 88%);
  background-color: hsl(0, 0%, 5%);
  background-image:
    radial-gradient(ellipse 120% 80% at 20% 10%, hsl(80, 8%, 14% / 0.55), transparent 55%),
    radial-gradient(ellipse 90% 70% at 85% 75%, hsl(40, 6%, 12% / 0.45), transparent 50%),
    repeating-linear-gradient(
      118deg,
      hsl(0, 0%, 7% / 0.35) 0 2px,
      transparent 2px 7px
    );
  transition: opacity 0.45s ease, visibility 0.45s ease;
}
#${OVERLAY_ID}[data-fading="true"] {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
#${OVERLAY_ID} .loading-panel {
  width: min(100%, 28rem);
  padding: 1.25rem 1.35rem 1.1rem;
  border-radius: 0.65rem;
  border: 1px solid hsl(0, 0%, 18%);
  background: hsl(0, 0%, 9% / 0.92);
  box-shadow: 0 12px 40px hsl(0, 0%, 0% / 0.45);
}
#${OVERLAY_ID} .loading-game {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}
#${OVERLAY_ID} .loading-step {
  margin: 0 0 0.75rem;
  font-size: 0.88rem;
  line-height: 1.45;
  color: hsl(0, 0%, 72%);
  word-break: break-word;
}
#${OVERLAY_ID} .loading-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
  font-size: 0.78rem;
  color: hsl(0, 0%, 55%);
}
#${OVERLAY_ID} .loading-bar {
  height: 6px;
  border-radius: 999px;
  background: hsl(0, 0%, 16%);
  overflow: hidden;
  margin-bottom: 0.85rem;
}
#${OVERLAY_ID} .loading-bar > span {
  display: block;
  height: 100%;
  width: 0%;
  border-radius: inherit;
  background: linear-gradient(90deg, hsl(210, 45%, 42%), hsl(210, 80%, 58%));
  transition: width 0.15s ease;
}
#${OVERLAY_ID} .loading-history {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.76rem;
  line-height: 1.35;
  color: hsl(0, 0%, 52%);
  max-height: 6.5rem;
  overflow: auto;
}
#${OVERLAY_ID} .loading-history li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.12rem 0;
}
#${OVERLAY_ID} .loading-history .ms {
  flex-shrink: 0;
  color: hsl(0, 0%, 42%);
  font-variant-numeric: tabular-nums;
}
#${OVERLAY_ID} .loading-elapsed {
  margin: 0.65rem 0 0;
  font-size: 0.74rem;
  color: hsl(0, 0%, 45%);
  font-variant-numeric: tabular-nums;
}
#${OVERLAY_ID} .loading-error {
  margin: 0.75rem 0 0;
  padding: 0.55rem 0.65rem;
  border-radius: 0.4rem;
  border: 1px solid hsl(0, 65%, 38%);
  background: hsl(0, 55%, 12% / 0.85);
  color: hsl(0, 85%, 72%);
  font-size: 0.8rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
`;

export interface LoadingScreen {
  /** Record an instantaneous startup step (sync work). */
  step(label: string): void;
  /** Track async work; logs timing and updates the overlay. */
  track<T>(promise: Promise<T>, label: string): Promise<T>;
  /** All startup tasks finished — wait for first painted frame, then fade out (unless errored). */
  done(): Promise<void>;
  /** Keep overlay visible and show a fatal load error. */
  fail(asset: string, error: unknown): void;
}

let activeScreen: LoadingScreen | null = null;

export function setActiveLoadingScreen(screen: LoadingScreen | null): void {
  activeScreen = screen;
}

export function getActiveLoadingScreen(): LoadingScreen | null {
  return activeScreen;
}

/** Track a promise when a loading screen is active (no-op otherwise). */
export function trackIfLoading<T>(promise: Promise<T>, label: string): Promise<T> {
  const screen = activeScreen;
  return screen ? screen.track(promise, label) : promise;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function basenameFromUrl(url: string): string {
  try {
    const path = new URL(url, 'http://local.invalid').pathname;
    const parts = path.split('/');
    return parts[parts.length - 1] || url;
  } catch {
    const slash = url.lastIndexOf('/');
    return slash >= 0 ? url.slice(slash + 1) : url;
  }
}

export function createLoadingScreen(options: { gameName: string }): LoadingScreen {
  if (typeof document === 'undefined') {
    const noop = async <T>(p: Promise<T>) => p;
    return {
      step() {},
      track: noop,
      async done() {},
      fail() {},
    };
  }

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = LOADING_CSS;
    document.head.append(style);
  }

  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.dataset.testid = 'loading-overlay';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-busy', 'true');

  const panel = document.createElement('div');
  panel.className = 'loading-panel';

  const title = document.createElement('h1');
  title.className = 'loading-game';
  title.textContent = options.gameName;

  const stepEl = document.createElement('p');
  stepEl.className = 'loading-step';
  stepEl.textContent = 'Starting…';

  const progressRow = document.createElement('div');
  progressRow.className = 'loading-progress-row';
  const progressText = document.createElement('span');
  const elapsedTop = document.createElement('span');
  progressRow.append(progressText, elapsedTop);

  const bar = document.createElement('div');
  bar.className = 'loading-bar';
  const barFill = document.createElement('span');
  bar.append(barFill);

  const historyEl = document.createElement('ul');
  historyEl.className = 'loading-history';

  const elapsedEl = document.createElement('p');
  elapsedEl.className = 'loading-elapsed';

  const errorEl = document.createElement('div');
  errorEl.className = 'loading-error';
  errorEl.hidden = true;

  panel.append(title, stepEl, progressRow, bar, historyEl, elapsedEl, errorEl);
  root.append(panel);
  document.body.append(root);

  const started = performance.now();
  let totalSteps = 0;
  let completedSteps = 0;
  let inFlight = 0;
  let errored = false;
  let currentStep = 'Starting…';
  const history: { label: string; ms: number }[] = [];
  let rafId = 0;

  function tickElapsed() {
    const ms = performance.now() - started;
    const text = `${(ms / 1000).toFixed(1)}s total`;
    elapsedEl.textContent = text;
    elapsedTop.textContent = text;
    if (!errored && !root.dataset.fading) rafId = requestAnimationFrame(tickElapsed);
  }
  rafId = requestAnimationFrame(tickElapsed);

  function render() {
    stepEl.textContent = currentStep;
    const denom = Math.max(totalSteps, completedSteps + inFlight, 1);
    progressText.textContent = `${completedSteps} / ${denom}`;
    barFill.style.width = `${Math.min(100, (completedSteps / denom) * 100)}%`;
    historyEl.replaceChildren(
      ...history.map(entry => {
        const li = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = entry.label;
        const ms = document.createElement('span');
        ms.className = 'ms';
        ms.textContent = `${entry.ms.toFixed(0)} ms`;
        li.append(label, ms);
        return li;
      }),
    );
  }

  function finishStep(label: string, ms: number) {
    completedSteps++;
    history.unshift({ label, ms });
    if (history.length > HISTORY_LIMIT) history.pop();
    console.log(`[load] ${label} — ${ms.toFixed(0)} ms`);
    render();
  }

  function fail(asset: string, error: unknown) {
    errored = true;
    root.setAttribute('aria-busy', 'true');
    const file = basenameFromUrl(asset);
    const message = formatError(error);
    errorEl.hidden = false;
    errorEl.textContent = `Failed: ${file}\n${asset}\n${message}`;
    currentStep = `Error loading ${file}`;
    console.error(`[load] FAILED ${asset}`, error);
    render();
  }

  const screen: LoadingScreen = {
    step(label: string) {
      totalSteps++;
      currentStep = label;
      const t0 = performance.now();
      finishStep(label, performance.now() - t0);
      currentStep = inFlight > 0 ? currentStep : label;
      render();
    },

    track<T>(promise: Promise<T>, label: string): Promise<T> {
      totalSteps++;
      inFlight++;
      currentStep = label;
      render();
      const t0 = performance.now();
      return promise.then(
        value => {
          inFlight--;
          finishStep(label, performance.now() - t0);
          if (inFlight === 0 && !errored) currentStep = completedSteps >= totalSteps ? 'Ready' : 'Loading…';
          render();
          return value;
        },
        error => {
          inFlight--;
          fail(label.includes('://') || label.includes('/') ? label : label, error);
          render();
          throw error;
        },
      );
    },

    async done() {
      while (inFlight > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, 16));
      }
      if (errored) return;
      currentStep = 'First frame…';
      render();
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      cancelAnimationFrame(rafId);
      root.dataset.fading = 'true';
      root.setAttribute('aria-busy', 'false');
      await new Promise<void>(resolve => {
        root.addEventListener('transitionend', () => resolve(), { once: true });
        setTimeout(resolve, 500);
      });
      root.remove();
    },

    fail,
  };

  render();
  return screen;
}
