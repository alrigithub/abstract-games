import type { ThemeId } from '@abstract/three-engine';
import type { PieceKind } from './types';
import { boopFootprintWorldUnits } from './boop-placement-footprints';

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

/** Bottom-left circular picker: small/big vase + placement footprint preview. */
export function createBoopThumbControl(options: BoopThumbControlOptions): BoopThumbControlHandle {
  let kind = options.initialKind;
  let theme = options.theme;

  const root = document.createElement('div');
  root.className = 'boop-thumb-control';
  root.dataset.testid = 'boop-thumb-control';

  const ring = document.createElement('div');
  ring.className = 'boop-thumb-control__ring';
  ring.dataset.testid = 'boop-thumb-ring';

  const kittenBtn = document.createElement('button');
  kittenBtn.type = 'button';
  kittenBtn.className = 'boop-thumb-control__size boop-thumb-control__size--kitten';
  kittenBtn.dataset.testid = 'boop-size-kitten';
  kittenBtn.setAttribute('aria-label', 'Place small vase');
  kittenBtn.title = 'Small vase';

  const catBtn = document.createElement('button');
  catBtn.type = 'button';
  catBtn.className = 'boop-thumb-control__size boop-thumb-control__size--cat';
  catBtn.dataset.testid = 'boop-size-cat';
  catBtn.setAttribute('aria-label', 'Place large vase');
  catBtn.title = 'Large vase';

  root.append(ring, kittenBtn, catBtn);
  options.mount.append(root);

  function footprintRatio(selected: PieceKind): number {
    const kitten = boopFootprintWorldUnits('kitten');
    const cat = boopFootprintWorldUnits('cat');
    const base = boopFootprintWorldUnits(selected);
    return base / cat;
  }

  function sync() {
    root.dataset.theme = theme;
    root.dataset.kind = kind;
    kittenBtn.dataset.selected = kind === 'kitten' ? 'true' : 'false';
    kittenBtn.setAttribute('aria-pressed', kind === 'kitten' ? 'true' : 'false');
    catBtn.dataset.selected = kind === 'cat' ? 'true' : 'false';
    catBtn.setAttribute('aria-pressed', kind === 'cat' ? 'true' : 'false');
    ring.style.setProperty('--boop-thumb-footprint', String(footprintRatio(kind)));
  }

  function pick(next: PieceKind) {
    if (kind === next) return;
    kind = next;
    sync();
    options.onKindChange(next);
  }

  kittenBtn.addEventListener('click', () => pick('kitten'));
  catBtn.addEventListener('click', () => pick('cat'));

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
