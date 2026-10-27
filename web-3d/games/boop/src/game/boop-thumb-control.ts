import type { ThemeId } from '@abstract/three-engine';
import { appendRingCircle } from './boop-ring-visual';
import type { PieceKind } from './types';

export interface BoopThumbControlOptions {
  mount: HTMLElement;
  initialKind: PieceKind;
  onKindChange: (kind: PieceKind) => void;
  theme: ThemeId;
}

export interface BoopThumbControlHandle {
  setKind(kind: PieceKind): void;
  getKind(): PieceKind;
  applyTheme(theme: ThemeId): void;
  destroy(): void;
}

function ariaLabelForKind(kind: PieceKind): string {
  return kind === 'cat'
    ? 'Large vase selected. Activate to place small vases.'
    : 'Small vase selected. Activate to place large vases.';
}

/** Bottom-left concentric ring control — one tap toggles small vs large vase. */
export function createBoopThumbControl(options: BoopThumbControlOptions): BoopThumbControlHandle {
  let kind = options.initialKind;
  let theme = options.theme;

  const root = document.createElement('div');
  root.className = 'boop-thumb-control';
  root.dataset.testid = 'boop-thumb-control';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'boop-thumb-control__toggle';
  toggle.dataset.testid = 'boop-size-toggle';
  toggle.setAttribute('role', 'switch');

  const halo = document.createElement('span');
  halo.className = 'boop-thumb-control__halo';
  halo.setAttribute('aria-hidden', 'true');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'boop-thumb-control__rings');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');

  toggle.append(halo, svg);
  root.append(toggle);
  options.mount.append(root);

  function drawRings() {
    svg.replaceChildren();
    const outerActive = kind === 'cat';
    appendRingCircle(svg, { cx: 50, cy: 50, r: 42, strokeWidth: 9, tone: outerActive ? 'active' : 'muted' });
    appendRingCircle(svg, {
      cx: 50,
      cy: 50,
      r: 17,
      strokeWidth: 4.5,
      tone: outerActive ? 'muted' : 'active',
    });
  }

  function sync() {
    root.dataset.theme = theme;
    root.dataset.kind = kind;
    toggle.setAttribute('aria-checked', kind === 'kitten' ? 'true' : 'false');
    toggle.setAttribute('aria-label', ariaLabelForKind(kind));
    toggle.title = kind === 'cat' ? 'Large vase' : 'Small vase';
    halo.classList.toggle('boop-thumb-control__halo--visible', kind === 'kitten');
    drawRings();
  }

  function pick(next: PieceKind) {
    if (kind === next) return;
    kind = next;
    sync();
    options.onKindChange(next);
  }

  toggle.addEventListener('click', () => {
    pick(kind === 'cat' ? 'kitten' : 'cat');
  });

  sync();

  return {
    setKind(next) {
      kind = next;
      sync();
    },
    getKind: () => kind,
    applyTheme(id) {
      theme = id;
      sync();
    },
    destroy() {
      root.remove();
    },
  };
}
