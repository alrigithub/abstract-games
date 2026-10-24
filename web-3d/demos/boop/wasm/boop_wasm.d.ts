export default function init(module?: RequestInfo | URL | Response | BufferSource): Promise<void>;

export class BoopGame {
  constructor();
  free(): void;
  view_json(): string;
  export_state(): string;
  static import_state(json: string): BoopGame;
  apply_move_json(json: string): string;
  move_for_interaction_json(player: string, x: number, y: number, preferred: string): string | undefined;
  choose_ai_move(max_depth: number): string | undefined;
  legal_moves_json(): string;
}
