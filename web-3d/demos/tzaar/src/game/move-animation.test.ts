import { describe, expect, it } from 'vitest';
import { AnimationQueue, motionDelay } from '@abstract/three-engine';
import {
  classifyMove,
  planActionCues,
  planTurnSequence,
  playCueSequence,
  TZAAR_ANIM,
} from './move-animation';
import { GameState, type Coord } from './state';

describe('Tzaar move animation sequence', () => {
  it('classifies capture vs stack vs pass from pre-apply state', () => {
    const game = new GameState();
    const opening = game.legalMoves()[0]!;
    expect(opening.tag).toBe('Action');
    expect(classifyMove(game, opening)).toBe('capture');
    expect(classifyMove(game, { tag: 'PassSecond' })).toBe('pass');
  });

  it('keeps stable piece ids across a capture', () => {
    const game = new GameState();
    const move = game.legalMoves()[0]!;
    if (move.tag !== 'Action') throw new Error('expected action');
    const movingIds = game.board.stack(move.from)!.pieces.map(piece => piece.id);
    expect(game.apply(move)).toBe(true);
    expect(game.board.stack(move.from)).toBeNull();
    expect(game.board.stack(move.to)!.pieces.map(piece => piece.id)).toEqual(movingIds);
  });

  it('plans a readable AI two-action turn in order', () => {
    const fromA: Coord = { x: 1, y: 0 };
    const toA: Coord = { x: 1, y: 1 };
    const fromB: Coord = { x: 3, y: 2 };
    const toB: Coord = { x: 4, y: 2 };
    const cues = planTurnSequence({
      actor: 'ai',
      reducedMotion: false,
      actions: [
        { kind: 'capture', from: fromA, to: toA, stackedHeight: 1 },
        { kind: 'stack', from: fromB, to: toB, stackedHeight: 3 },
      ],
    });
    expect(cues.map(cue => cue.type)).toEqual([
      'think',
      'highlightSource',
      'lift',
      'glide',
      'captureDepart',
      'land',
      'betweenActions',
      'think',
      'highlightSource',
      'lift',
      'glide',
      'land',
      'lastMove',
    ]);
    const glides = cues.filter(cue => cue.type === 'glide');
    expect(glides[0]).toMatchObject({ ms: TZAAR_ANIM.AI_MOVE_MS, kind: 'capture' });
    expect(glides[1]).toMatchObject({ ms: TZAAR_ANIM.AI_MOVE_MS, kind: 'stack' });
    expect(cues.at(-1)).toEqual({ type: 'lastMove', from: fromB, to: toB });
  });

  it('shows an AI pass toast after the first action and keeps the last capture highlight', () => {
    const from: Coord = { x: 2, y: 1 };
    const to: Coord = { x: 2, y: 2 };
    const cues = planTurnSequence({
      actor: 'ai',
      reducedMotion: false,
      actions: [
        { kind: 'capture', from, to, stackedHeight: 1 },
        { kind: 'pass' },
      ],
    });
    expect(cues.map(cue => cue.type)).toContain('passToast');
    expect(cues.at(-1)).toEqual({ type: 'lastMove', from, to });
  });

  it('uses a faster human glide and skips think / last-move / between pauses', () => {
    const cues = planActionCues({
      actor: 'human',
      reducedMotion: false,
      includeThink: false,
      action: { kind: 'capture', from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, stackedHeight: 1 },
    });
    expect(cues.map(cue => cue.type)).toEqual([
      'highlightSource',
      'lift',
      'glide',
      'captureDepart',
      'land',
    ]);
    expect(cues.find(cue => cue.type === 'glide')).toMatchObject({ ms: TZAAR_ANIM.HUMAN_MOVE_MS });
  });

  it('collapses motion to instant cues when reduced-motion is set', () => {
    const cues = planTurnSequence({
      actor: 'ai',
      reducedMotion: true,
      actions: [
        { kind: 'capture', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, stackedHeight: 1 },
        { kind: 'pass' },
      ],
    });
    expect(cues.map(cue => cue.type)).toEqual(['glide', 'captureDepart', 'land', 'passToast', 'lastMove']);
    expect(cues.find(cue => cue.type === 'glide')).toMatchObject({ ms: 0 });
  });

  it('plays queued cues sequentially through the animation queue', async () => {
    const log: string[] = [];
    const queue = new AnimationQueue();
    const cues = planActionCues({
      actor: 'ai',
      reducedMotion: true,
      includeThink: false,
      action: { kind: 'stack', from: { x: 1, y: 1 }, to: { x: 1, y: 2 }, stackedHeight: 2 },
    });
    await queue.enqueue(() =>
      playCueSequence(cues, {
        delay: async ms => {
          await motionDelay(ms, true);
          log.push(`delay:${ms}`);
        },
        highlightSource: from => log.push(`highlight:${from.x},${from.y}`),
        lift: from => log.push(`lift:${from.x},${from.y}`),
        glide: async cue => {
          log.push(`glide:${cue.from.x},${cue.from.y}->${cue.to.x},${cue.to.y}:${cue.ms}`);
        },
        captureDepart: to => log.push(`fade:${to.x},${to.y}`),
        land: (to, height) => log.push(`land:${to.x},${to.y}:${height}`),
        passToast: () => log.push('pass'),
        lastMove: (from, to) => log.push(`last:${from.x},${from.y}->${to.x},${to.y}`),
      }),
    );
    await queue.drain();
    expect(queue.busy).toBe(false);
    expect(log).toEqual(['glide:1,1->1,2:0', 'land:1,2:2']);
  });
});
