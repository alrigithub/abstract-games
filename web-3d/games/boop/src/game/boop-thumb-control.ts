import type { ThemeId } from '@abstract/three-engine';
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

/** Bottom-left small/big vase picker (two simple circles). */
export function createBoopThumbControl(options: BoopThumbControlOptions): BoopThumbControlHandle {
  let kind = options.initialKind;
  let theme = options.theme;

  const root = document.createElement('div');
  root.className = 'boop-thumb-control';
  root.dataset.testid = 'boop-thumb-control';

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

  root.append(kittenBtn, catBtn);
  options.mount.append(root);

  function sync() {
    root.dataset.theme = theme;
    root.dataset.kind = kind;
    kittenBtn.dataset.selected = kind === 'kitten' ? 'true' : 'false';
    kittenBtn.setAttribute('aria-pressed', kind === 'kitten' ? 'true' : 'false');
    catBtn.dataset.selected = kind === 'cat' ? 'true' : 'false';
    catBtn.setAttribute('aria-pressed', kind === 'cat' ? 'true' : 'false');
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
