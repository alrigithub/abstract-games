export type PlayerId = 'A' | 'B';
export type PieceKind = 'kitten' | 'cat';

export interface PoolView {
  kittens_in_hand: number;
  cats_in_hand: number;
  cats_in_reserve: number;
}

export type TurnModeView =
  | { kind: 'place' }
  | { kind: 'alternate_graduation' }
  | { kind: 'choose_graduation'; lines: [number, number][][] };

export type LineHighlightView =
  | { kind: 'graduation'; line: [number, number][] }
  | { kind: 'win'; line: [number, number][] }
  | { kind: 'eight_cats_on_bed' };

export interface EffectsView {
  displacements: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    player: PlayerId;
    kind: PieceKind;
  }[];
  off_board: {
    from: { x: number; y: number };
    player: PlayerId;
    kind: PieceKind;
    push_x: number;
    push_y: number;
  }[];
  line_highlight: LineHighlightView | null;
  graduated_cells: [number, number][] | null;
}

export interface GameView {
  to_move: PlayerId;
  winner: PlayerId | null;
  turn_mode: TurnModeView;
  board: ({ player: PlayerId; kind: PieceKind } | null)[][];
  pools: [PoolView, PoolView];
  effects: EffectsView;
}

export type MoveJson =
  | { type: 'place'; x: number; y: number; piece: PieceKind }
  | { type: 'graduate'; line: [number, number][] }
  | { type: 'graduate_single_kitten'; x: number; y: number }
  | { type: 'return_cat_to_pool'; x: number; y: number };

export function parseGameView(json: string): GameView {
  return JSON.parse(json) as GameView;
}
