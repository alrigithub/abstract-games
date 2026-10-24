import type { Coord, GameState, Move } from './state';

export const TZAAR_ANIM = {
  AI_THINK_MS: 500,
  AI_MOVE_MS: 600,
  HUMAN_MOVE_MS: 300,
  BETWEEN_ACTIONS_MS: 420,
  SOURCE_HIGHLIGHT_MS: 240,
  LIFT_MS: 160,
  CAPTURE_FADE_MS: 380,
  PASS_TOAST_MS: 1100,
  LIFT: 0.22,
} as const;

export type ActionKind = 'capture' | 'stack' | 'pass';
export type Actor = 'ai' | 'human';

export type AnimCue =
  | { type: 'think'; ms: number }
  | { type: 'highlightSource'; from: Coord }
  | { type: 'lift'; from: Coord }
  | { type: 'glide'; from: Coord; to: Coord; ms: number; kind: 'capture' | 'stack' }
  | { type: 'captureDepart'; to: Coord }
  | { type: 'land'; to: Coord; height: number }
  | { type: 'passToast' }
  | { type: 'betweenActions'; ms: number }
  | { type: 'lastMove'; from: Coord; to: Coord };

export interface PlannedAction {
  kind: ActionKind;
  from?: Coord;
  to?: Coord;
  stackedHeight?: number;
}

export function classifyMove(state: GameState, move: Move): ActionKind {
  if (move.tag === 'PassSecond') return 'pass';
  const dest = state.board.stack(move.to);
  if (!dest || dest.owner !== state.toMove) return 'capture';
  return 'stack';
}

export function planActionCues(options: {
  actor: Actor;
  action: PlannedAction;
  reducedMotion: boolean;
  includeThink: boolean;
}): AnimCue[] {
  const { actor, action, reducedMotion, includeThink } = options;
  const cues: AnimCue[] = [];
  if (includeThink && !reducedMotion) cues.push({ type: 'think', ms: TZAAR_ANIM.AI_THINK_MS });

  if (action.kind === 'pass') {
    cues.push({ type: 'passToast' });
    return cues;
  }

  const from = action.from!;
  const to = action.to!;
  const height = action.stackedHeight ?? 1;
  const moveMs = reducedMotion ? 0 : actor === 'ai' ? TZAAR_ANIM.AI_MOVE_MS : TZAAR_ANIM.HUMAN_MOVE_MS;

  if (!reducedMotion) {
    cues.push({ type: 'highlightSource', from });
    cues.push({ type: 'lift', from });
  }
  cues.push({ type: 'glide', from, to, ms: moveMs, kind: action.kind });
  if (action.kind === 'capture') cues.push({ type: 'captureDepart', to });
  cues.push({ type: 'land', to, height });
  return cues;
}

export function planTurnSequence(options: {
  actor: Actor;
  actions: PlannedAction[];
  reducedMotion: boolean;
}): AnimCue[] {
  const cues: AnimCue[] = [];
  let lastPath: { from: Coord; to: Coord } | undefined;
  for (const [index, action] of options.actions.entries()) {
    if (index > 0 && !options.reducedMotion) {
      cues.push({ type: 'betweenActions', ms: TZAAR_ANIM.BETWEEN_ACTIONS_MS });
    }
    cues.push(
      ...planActionCues({
        actor: options.actor,
        action,
        reducedMotion: options.reducedMotion,
        includeThink: options.actor === 'ai',
      }),
    );
    if (action.from && action.to) lastPath = { from: action.from, to: action.to };
  }
  if (options.actor === 'ai' && lastPath) cues.push({ type: 'lastMove', ...lastPath });
  return cues;
}

export async function playCueSequence(
  cues: AnimCue[],
  hooks: {
    delay: (ms: number) => Promise<void>;
    highlightSource: (from: Coord) => void;
    lift: (from: Coord) => void;
    glide: (cue: Extract<AnimCue, { type: 'glide' }>) => Promise<void>;
    captureDepart: (to: Coord) => void;
    land: (to: Coord, height: number) => void;
    passToast: () => void;
    lastMove: (from: Coord, to: Coord) => void;
  },
): Promise<void> {
  for (const cue of cues) {
    switch (cue.type) {
      case 'think':
      case 'betweenActions':
        await hooks.delay(cue.ms);
        break;
      case 'highlightSource':
        hooks.highlightSource(cue.from);
        await hooks.delay(TZAAR_ANIM.SOURCE_HIGHLIGHT_MS);
        break;
      case 'lift':
        hooks.lift(cue.from);
        await hooks.delay(TZAAR_ANIM.LIFT_MS);
        break;
      case 'glide':
        await hooks.glide(cue);
        break;
      case 'captureDepart':
        hooks.captureDepart(cue.to);
        break;
      case 'land':
        hooks.land(cue.to, cue.height);
        break;
      case 'passToast':
        hooks.passToast();
        await hooks.delay(TZAAR_ANIM.PASS_TOAST_MS);
        break;
      case 'lastMove':
        hooks.lastMove(cue.from, cue.to);
        break;
    }
  }
}
