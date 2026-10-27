import { describe, expect, it, vi } from 'vitest';
import { createBoopThumbControl } from './boop-thumb-control';

describe('createBoopThumbControl', () => {
  it('toggles between cat and kitten on each click', () => {
    const mount = document.createElement('div');
    const onKindChange = vi.fn();
    const control = createBoopThumbControl({
      mount,
      initialKind: 'kitten',
      theme: 'light',
      onKindChange,
    });

    const toggle = mount.querySelector<HTMLButtonElement>('[data-testid="boop-size-toggle"]')!;
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(control.getKind()).toBe('kitten');

    toggle.click();
    expect(onKindChange).toHaveBeenCalledWith('cat');
    expect(control.getKind()).toBe('cat');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    toggle.click();
    expect(onKindChange).toHaveBeenCalledWith('kitten');
    expect(control.getKind()).toBe('kitten');

    control.destroy();
  });

  it('reflects programmatic setKind', () => {
    const mount = document.createElement('div');
    const control = createBoopThumbControl({
      mount,
      initialKind: 'cat',
      theme: 'light',
      onKindChange: () => {},
    });
    control.setKind('kitten');
    expect(mount.querySelector('.boop-thumb-control')?.getAttribute('data-kind')).toBe('kitten');
    control.destroy();
  });
});
