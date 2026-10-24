import type { SceneApi } from '@abstract/three-engine';
import { coordToIndex, gameToSnapshot } from './game/snapshot';
import type { Coord, GameState } from './game/state';

export interface StackLabelOverrides {
  hide?: ReadonlySet<string>;
  flying?: { pieceId: string; height: number };
}

export function createStackHeightLabels(board: HTMLElement, scene: SceneApi) {
  const layer = document.createElement('div');
  layer.className = 'stack-height-layer';
  layer.setAttribute('data-testid', 'stack-height-layer');
  board.append(layer);

  const nodes = new Map<string, HTMLDivElement>();

  function nodeFor(id: string): HTMLDivElement {
    let el = nodes.get(id);
    if (el) return el;
    el = document.createElement('div');
    el.className = 'stack-height';
    el.dataset.testid = 'stack-height';
    layer.append(el);
    nodes.set(id, el);
    return el;
  }

  function place(el: HTMLDivElement, pieceId: string, height: number) {
    const world = scene.getPieceWorldPosition(pieceId);
    const pt = world ? scene.projectToScreen(world) : null;
    if (!pt || height < 2) {
      el.hidden = true;
      return;
    }
    const rect = board.getBoundingClientRect();
    el.hidden = false;
    el.textContent = String(height);
    el.style.left = `${pt.x - rect.left}px`;
    el.style.top = `${pt.y - rect.top - 18}px`;
  }

  function sync(game: GameState, overrides: StackLabelOverrides = {}) {
    const used = new Set<string>();
    const snapshot = gameToSnapshot(game);
    snapshot.cells.forEach((stack, index) => {
      if (!stack.length) return;
      const key = `cell-${index}`;
      if (overrides.hide?.has(key)) return;
      const top = stack[stack.length - 1]!;
      const el = nodeFor(key);
      used.add(key);
      place(el, top.id, stack.length);
    });
    if (overrides.flying) {
      const el = nodeFor('flying');
      used.add('flying');
      place(el, overrides.flying.pieceId, overrides.flying.height);
    }
    for (const [id, el] of nodes) {
      if (!used.has(id)) {
        el.remove();
        nodes.delete(id);
      }
    }
  }

  function hideCell(coord: Coord): string {
    return `cell-${coordToIndex(coord)}`;
  }

  function clear() {
    layer.replaceChildren();
    nodes.clear();
  }

  return { sync, hideCell, clear };
}
