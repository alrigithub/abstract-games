import type { PieceKind } from './types';
import { boopUiAsset } from './boop-ring-ui';

export interface BoopSizeControlOptions {
  mount: HTMLElement;
  initialKind: PieceKind;
  onKindChange: (kind: PieceKind) => void;
}

export interface BoopSizeControlHandle {
  setKind(kind: PieceKind): void;
  getKind(): PieceKind;
  destroy(): void;
}

const LABEL: Record<PieceKind, string> = {
  kitten: 'Small vase',
  cat: 'Big vase',
};

/**
 * One concentric-ring control. Click toggles big vase (control-big.svg)
 * and small vase (control-small.svg).
 */
export function createBoopSizeControl(options: BoopSizeControlOptions): BoopSizeControlHandle {
  let kind = options.initialKind;

  const root = document.createElement('div');
  root.className = 'boop-size-control';
  root.dataset.testid = 'boop-thumb-control';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'boop-size-control__button';
  button.dataset.testid = 'boop-size-toggle';

  const artBig = document.createElement('img');
  artBig.className = 'boop-size-control__art boop-size-control__art--big';
  artBig.alt = '';
  artBig.draggable = false;
  artBig.src = boopUiAsset('control-big.svg');
  artBig.width = 256;
  artBig.height = 256;

  const artSmall = document.createElement('img');
  artSmall.className = 'boop-size-control__art boop-size-control__art--small';
  artSmall.alt = '';
  artSmall.draggable = false;
  artSmall.src = boopUiAsset('control-small.svg');
  artSmall.width = 256;
  artSmall.height = 256;

  const label = document.createElement('span');
  label.className = 'boop-size-control__label';

  button.append(artBig, artSmall, label);
  root.append(button);
  options.mount.append(root);

  function sync() {
    const big = kind === 'cat';
    root.dataset.kind = kind;
    button.dataset.kind = kind;
    button.setAttribute('aria-pressed', big ? 'true' : 'false');
    button.setAttribute(
      'aria-label',
      big ? 'Big vase. Switch to small vase.' : 'Small vase. Switch to big vase.',
    );
    button.title = LABEL[kind];
    label.textContent = LABEL[kind];
    artBig.hidden = !big;
    artSmall.hidden = big;
  }

  button.addEventListener('click', () => {
    options.onKindChange(kind === 'kitten' ? 'cat' : 'kitten');
  });

  sync();

  return {
    setKind(next) {
      kind = next;
      sync();
    },
    getKind: () => kind,
    destroy() {
      root.remove();
    },
  };
}
