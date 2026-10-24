import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOBBY_HREF, resolveDefaultLobbyHref } from './game-buttons';

describe('resolveDefaultLobbyHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a path relative to the hub layout', () => {
    expect(DEFAULT_LOBBY_HREF).toBe('../index.html');
  });

  it('resolves to web/index.html from a published game path', () => {
    vi.stubGlobal('document', {
      location: { href: 'https://example.github.io/abstract-games/web/tak/index.html' },
    });
    expect(resolveDefaultLobbyHref()).toBe('https://example.github.io/abstract-games/web/index.html');
  });

  it('resolves from Firebase-style /tak/ deploy when web/ is the host root', () => {
    vi.stubGlobal('document', {
      location: { href: 'https://my-game.web.app/tak/index.html' },
    });
    expect(resolveDefaultLobbyHref()).toBe('https://my-game.web.app/index.html');
  });

  it('falls back when document is unavailable', () => {
    vi.stubGlobal('document', undefined);
    expect(resolveDefaultLobbyHref()).toBe('../index.html');
  });
});
