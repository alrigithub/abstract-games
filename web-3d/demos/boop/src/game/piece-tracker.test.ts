import { describe, expect, it } from 'vitest';
import { PieceTracker } from './piece-tracker';

describe('PieceTracker.takeForPlacement', () => {
  it('uses preferredId from the selected pool piece', () => {
    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    const top = tracker.takeForPlacement('A', 'kitten');
    const second = tracker.takeForPlacement('A', 'kitten');
    expect(top?.id).not.toBe(second?.id);

    tracker.resetFromNewGame();
    const stacks = { A: { kitten: ['k-a', 'k-b'], cat: [] as string[] }, B: { kitten: [], cat: [] as string[] } };
    (tracker as unknown as { poolStacks: typeof stacks }).poolStacks = stacks;

    const taken = tracker.takeForPlacement('A', 'kitten', 'k-a');
    expect(taken?.id).toBe('k-a');
    expect(stacks.A.kitten).toEqual(['k-b']);
  });
});
