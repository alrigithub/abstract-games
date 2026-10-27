import * as THREE from 'three';
import presets from './boop-lighting-presets.json';

export const BOOP_LIGHTING_PRESETS = presets;
export type BoopLightingId = keyof typeof presets;
export const DEFAULT_BOOP_LIGHTING: BoopLightingId = 'daylight';
const STORAGE_KEY = 'boop-lighting-preset';

export function isBoopLightingId(value: string | null): value is BoopLightingId {
  return value !== null && Object.prototype.hasOwnProperty.call(presets, value);
}

export function resolveBoopLighting(query: string | null, saved: string | null): BoopLightingId {
  return isBoopLightingId(query) ? query : isBoopLightingId(saved) ? saved : DEFAULT_BOOP_LIGHTING;
}

export function readBoopLighting(): BoopLightingId {
  let saved: string | null = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage can be disabled */ }
  return resolveBoopLighting(new URLSearchParams(location.search).get('lighting'), saved);
}

const plates = new Map<BoopLightingId, Promise<THREE.Texture>>();
export function loadBoopLightingTexture(id: BoopLightingId): Promise<THREE.Texture> {
  let pending = plates.get(id);
  if (!pending) {
    pending = new THREE.TextureLoader()
      .loadAsync(`${import.meta.env.BASE_URL}prerender/${presets[id].plate}`)
      .then(texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      }).catch(error => {
        plates.delete(id);
        throw error;
      });
    plates.set(id, pending);
  }
  return pending;
}

/** Lighting changes preserve the current match, camera and piece positions. */
export function mountBoopLightingMenu(
  root: HTMLElement,
  initial: BoopLightingId,
  apply: (id: BoopLightingId) => Promise<void>,
): void {
  const menu = root.querySelector<HTMLElement>('[data-testid="game-menu"]');
  if (!menu) return;
  const group = document.createElement('div');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Lighting');
  group.style.cssText = 'border-top:1px solid #deded8;margin-top:6px;padding-top:6px';
  const heading = document.createElement('div');
  heading.textContent = 'Lighting';
  heading.style.cssText = 'padding:5px 12px;font-size:11px;color:#65675e;font-weight:600';
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  status.style.cssText = 'padding:0 12px;font-size:11px;color:#65675e';
  group.append(heading);
  let current = initial;
  const buttons = new Map<BoopLightingId, HTMLButtonElement>();
  const sync = () => {
    for (const [id, button] of buttons) {
      button.setAttribute('aria-checked', String(id === current));
      button.textContent = `${id === current ? '✓ ' : ''}${presets[id].label}`;
    }
  };
  for (const id of Object.keys(presets) as BoopLightingId[]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-menu-item';
    button.tabIndex = -1;
    button.setAttribute('role', 'menuitemradio');
    button.dataset.testid = `lighting-${id}`;
    button.addEventListener('click', async () => {
      if (id === current) return;
      buttons.forEach(item => { item.disabled = true; });
      status.textContent = 'Loading lighting…';
      try {
        await apply(id);
        current = id;
        sync();
        try { localStorage.setItem(STORAGE_KEY, id); } catch { /* optional persistence */ }
        const url = new URL(location.href);
        url.searchParams.set('lighting', id);
        history.replaceState(null, '', url);
        status.textContent = '';
      } catch {
        status.textContent = 'Could not load this lighting. Please try again.';
      } finally {
        buttons.forEach(item => { item.disabled = false; });
      }
    });
    buttons.set(id, button);
    group.append(button);
  }
  group.append(status);
  menu.append(group);
  sync();
}
