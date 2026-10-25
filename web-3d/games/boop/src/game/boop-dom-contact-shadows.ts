import { pxPerWorldUnit, type BoardSnapshot, type SceneApi, type ThemeId } from '@abstract/three-engine';
import { cellAt } from './boop-interaction';
import { boopFootprintWorldUnits } from './boop-placement-footprints';

export interface BoopDomContactShadowsOptions {
  board: HTMLElement;
  scene: SceneApi;
  getSnapshot: () => BoardSnapshot;
  getTheme: () => ThemeId;
}

export interface BoopDomContactShadowsHandle {
  start(): void;
  stop(): void;
  sync(): void;
}

/** Screen-space contact halos drawn above the WebGL canvas (pool, tray, bed, animations). */
export function createBoopDomContactShadows(options: BoopDomContactShadowsOptions): BoopDomContactShadowsHandle {
  const layer = document.createElement('div');
  layer.className = 'boop-dom-contact-shadows';
  layer.dataset.testid = 'boop-dom-contact-shadows';
  layer.setAttribute('aria-hidden', 'true');
  options.board.appendChild(layer);

  const pool = new Map<string, HTMLDivElement>();
  let raf = 0;

  function footprintPx(kind: 'kitten' | 'cat'): number {
    const pxPerUnit = pxPerWorldUnit(options.scene, cellAt);
    return boopFootprintWorldUnits(kind) * pxPerUnit * 0.82;
  }

  function sync() {
    const snap = options.getSnapshot();
    const theme = options.getTheme();
    layer.dataset.theme = theme;
    const boardRect = options.board.getBoundingClientRect();
    const seen = new Set<string>();

    for (let index = 0; index < snap.cellCount; index++) {
      const stack = snap.cells[index] ?? [];
      for (const piece of stack) {
        seen.add(piece.id);
        const world = options.scene.getPieceWorldPosition(piece.id);
        if (!world) continue;
        const contactY = options.scene.getBoardTopY() + 0.002;
        const screen = options.scene.projectToScreen({ x: world.x, y: contactY, z: world.z });
        const kind = piece.shape === 'kitten' ? 'kitten' : 'cat';
        let el = pool.get(piece.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'boop-dom-contact-shadow';
          pool.set(piece.id, el);
          layer.appendChild(el);
        }
        const size = footprintPx(kind);
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.left = `${screen.x - boardRect.left}px`;
        el.style.top = `${screen.y - boardRect.top}px`;
      }
    }

    for (const [id, el] of pool) {
      if (seen.has(id)) continue;
      el.remove();
      pool.delete(id);
    }
  }

  function tick() {
    sync();
    raf = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (raf) return;
      raf = requestAnimationFrame(tick);
      options.board.addEventListener('camera-change', sync);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      options.board.removeEventListener('camera-change', sync);
      layer.remove();
      pool.clear();
    },
    sync,
  };
}
