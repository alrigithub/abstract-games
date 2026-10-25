/**
 * Full-screen startup overlay shared by every 3D game. Matches the live Firebase lobby
 * (https://bimsavage-games.web.app/): ui-sans-serif stack + landing-bg2.jpg pile texture.
 */

const OVERLAY_ID = 'abstract-loading-overlay';
const STYLE_ID = 'abstract-loading-screen-styles';
const HISTORY_LIMIT = 8;

/** Same stack as the deployed lobby (no custom @font-face). */
export const LOBBY_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const LOBBY_BG_COLOR = '#e4e4e2';
const LOBBY_TEXT = '#2b2b2b';
const LOBBY_MUTED = '#777777';

/** Resolve landing JPEG like the lobby: sibling img/ on hosted builds, ./img/ in Vite dev. */
export function resolveLandingBackgroundUrl(): string {
  if (typeof document === 'undefined') return 'img/landing-bg2.jpg';
  const path = document.location.pathname;
  const inGameSubfolder = /\/(tak|gomoku|boop|yinsh|tzaar)(\/|$)/.test(path);
  const rel = inGameSubfolder ? '../img/landing-bg2.jpg' : 'img/landing-bg2.jpg';
  return new URL(rel, document.location.href).href;
}

const LOADING_CSS = `
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 0 0 clamp(28px, 8vw, 120px);
  font-family: ${LOBBY_FONT_FAMILY};
  color: ${LOBBY_TEXT};
  background-color: ${LOBBY_BG_COLOR};
  background-position: right center;
  background-size: cover;
  background-repeat: no-repeat;
  transition: opacity 0.45s ease, visibility 0.45s ease;
}
@media (max-aspect-ratio: 1/1) {
  #${OVERLAY_ID} { background-position: 70% center; }
}
#${OVERLAY_ID}[data-fading="true"] {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
#${OVERLAY_ID} .loading-panel {
  width: min(100%, 28rem);
  padding: 0.35rem 0 0;
  background: transparent;
  box-shadow: none;
}
#${OVERLAY_ID} .loading-kicker {
  margin: 0 0 12px;
  font-weight: 400;
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${LOBBY_MUTED};
}
#${OVERLAY_ID} .loading-game {
  margin: 0 0 1rem;
  font-size: clamp(28px, 4vw, 44px);
  font-weight: 300;
  line-height: 1.35;
  letter-spacing: normal;
}
#${OVERLAY_ID} .loading-step {
  margin: 0 0 0.75rem;
  font-size: 0.92rem;
  line-height: 1.45;
  font-weight: 400;
  color: ${LOBBY_MUTED};
  word-break: break-word;
}
#${OVERLAY_ID} .loading-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
  font-size: 0.78rem;
  color: ${LOBBY_MUTED};
}
#${OVERLAY_ID} .loading-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: 0.85rem;
  max-width: 20rem;
}
#${OVERLAY_ID} .loading-bar > span {
  display: block;
  height: 100%;
  width: 0%;
  border-radius: inherit;
  background: ${LOBBY_TEXT};
  opacity: 0.55;
  transition: width 0.15s ease;
}
#${OVERLAY_ID} .loading-history {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.76rem;
  line-height: 1.35;
  color: ${LOBBY_MUTED};
  max-height: 6.5rem;
  overflow: auto;
  max-width: 28rem;
}
#${OVERLAY_ID} .loading-history li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.12rem 0;
}
#${OVERLAY_ID} .loading-history .ms {
  flex-shrink: 0;
  color: #999;
  font-variant-numeric: tabular-nums;
}
#${OVERLAY_ID} .loading-elapsed {
  margin: 0.65rem 0 0;
  font-size: 0.74rem;
  color: ${LOBBY_MUTED};
  font-variant-numeric: tabular-nums;
}
#${OVERLAY_ID} .loading-error {
  margin: 0.75rem 0 0;
  padding: 0.55rem 0.65rem;
  border-radius: 0.4rem;
  border: 1px solid #c44;
  background: rgba(255, 240, 240, 0.92);
  color: #8b0000;
  font-size: 0.8rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 28rem;
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

  root.style.backgroundImage = `url("${resolveLandingBackgroundUrl()}")`;

  const panel = document.createElement('div');
  panel.className = 'loading-panel';

  const kicker = document.createElement('p');
  kicker.className = 'loading-kicker';
  kicker.textContent = 'Loading';

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

  panel.append(kicker, title, stepEl, progressRow, bar, historyEl, elapsedEl, errorEl);
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
