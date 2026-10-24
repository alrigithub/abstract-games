use serde::{Deserialize, Serialize};
use tzaar::{
    Board, Coord, GameState, Move, Piece, PieceKind, Player, Stack, TurnPhase,
};
use tzaar_ai::choose_move;
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
struct CoordJson {
    x: i8,
    y: i8,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
enum PlayerJson {
    First,
    Second,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
enum PieceKindJson {
    Tzaar,
    Tzarra,
    Tott,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
struct PieceJson {
    player: PlayerJson,
    kind: PieceKindJson,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StackJson {
    pieces: Vec<PieceJson>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BoardJson {
    stacks: Vec<Option<StackJson>>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
enum TurnPhaseJson {
    WhiteOpening,
    ForcedCapture,
    OptionalSecond,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum MoveJson {
    Action { from: CoordJson, to: CoordJson },
    PassSecond,
}

#[derive(Debug, Serialize, Deserialize)]
struct RenderState {
    board: BoardJson,
    to_move: PlayerJson,
    phase: TurnPhaseJson,
    winner: Option<PlayerJson>,
    legal_moves: Vec<MoveJson>,
    human_turn: bool,
    can_pass: bool,
}

impl From<Player> for PlayerJson {
    fn from(p: Player) -> Self {
        match p {
            Player::First => PlayerJson::First,
            Player::Second => PlayerJson::Second,
        }
    }
}

impl From<PlayerJson> for Player {
    fn from(p: PlayerJson) -> Self {
        match p {
            PlayerJson::First => Player::First,
            PlayerJson::Second => Player::Second,
        }
    }
}

impl From<PieceKind> for PieceKindJson {
    fn from(k: PieceKind) -> Self {
        match k {
            PieceKind::Tzaar => PieceKindJson::Tzaar,
            PieceKind::Tzarra => PieceKindJson::Tzarra,
            PieceKind::Tott => PieceKindJson::Tott,
        }
    }
}

impl From<PieceKindJson> for PieceKind {
    fn from(k: PieceKindJson) -> Self {
        match k {
            PieceKindJson::Tzaar => PieceKind::Tzaar,
            PieceKindJson::Tzarra => PieceKind::Tzarra,
            PieceKindJson::Tott => PieceKind::Tott,
        }
    }
}

impl From<Piece> for PieceJson {
    fn from(p: Piece) -> Self {
        PieceJson {
            player: p.player.into(),
            kind: p.kind.into(),
        }
    }
}

impl From<PieceJson> for Piece {
    fn from(p: PieceJson) -> Self {
        Piece {
            player: p.player.into(),
            kind: p.kind.into(),
        }
    }
}

impl From<TurnPhase> for TurnPhaseJson {
    fn from(p: TurnPhase) -> Self {
        match p {
            TurnPhase::WhiteOpening => TurnPhaseJson::WhiteOpening,
            TurnPhase::ForcedCapture => TurnPhaseJson::ForcedCapture,
            TurnPhase::OptionalSecond => TurnPhaseJson::OptionalSecond,
        }
    }
}

impl From<TurnPhaseJson> for TurnPhase {
    fn from(p: TurnPhaseJson) -> Self {
        match p {
            TurnPhaseJson::WhiteOpening => TurnPhase::WhiteOpening,
            TurnPhaseJson::ForcedCapture => TurnPhase::ForcedCapture,
            TurnPhaseJson::OptionalSecond => TurnPhase::OptionalSecond,
        }
    }
}

impl From<Coord> for CoordJson {
    fn from(c: Coord) -> Self {
        Self { x: c.x, y: c.y }
    }
}

impl From<CoordJson> for Coord {
    fn from(c: CoordJson) -> Self {
        Coord::new(c.x, c.y)
    }
}

impl From<Move> for MoveJson {
    fn from(m: Move) -> Self {
        match m {
            Move::Action { from, to } => MoveJson::Action {
                from: from.into(),
                to: to.into(),
            },
            Move::PassSecond => MoveJson::PassSecond,
        }
    }
}

impl TryFrom<MoveJson> for Move {
    type Error = String;

    fn try_from(m: MoveJson) -> Result<Self, Self::Error> {
        Ok(match m {
            MoveJson::Action { from, to } => Move::Action {
                from: from.into(),
                to: to.into(),
            },
            MoveJson::PassSecond => Move::PassSecond,
        })
    }
}

fn board_to_json(board: &Board) -> BoardJson {
    let mut stacks = Vec::with_capacity(81);
    for y in 0..9 {
        for x in 0..9 {
            let coord = Coord::new(x, y);
            stacks.push(board.stack(coord).map(|s| StackJson {
                pieces: s.pieces().iter().copied().map(PieceJson::from).collect(),
            }));
        }
    }
    BoardJson { stacks }
}

fn board_from_json(json: &BoardJson) -> Board {
    let mut board = Board::default();
    for y in 0..9 {
        for x in 0..9 {
            let idx = (y as usize) * 9 + x as usize;
            let Some(stack_json) = json.stacks.get(idx).and_then(|s| s.as_ref()) else {
                continue;
            };
            let coord = Coord::new(x, y);
            let pieces: Vec<Piece> = stack_json
                .pieces
                .iter()
                .copied()
                .map(Piece::from)
                .collect();
            if !pieces.is_empty() {
                board.set_stack(coord, Stack::from_pieces(pieces));
            }
        }
    }
    board
}

fn render_state_from(state: GameState) -> RenderState {
    let winner = state.winner();
    let human_turn = state.to_move() == Player::First && winner.is_none();
    let can_pass = state.phase() == TurnPhase::OptionalSecond && winner.is_none();
    let legal_moves: Vec<MoveJson> = if winner.is_some() {
        vec![]
    } else {
        state.legal_moves().into_iter().map(MoveJson::from).collect()
    };

    RenderState {
        board: board_to_json(state.board()),
        to_move: state.to_move().into(),
        phase: state.phase().into(),
        winner: winner.map(PlayerJson::from),
        legal_moves,
        human_turn,
        can_pass,
    }
}

fn parse_render(json: &str) -> Result<RenderState, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}

fn state_from_render(render: &RenderState) -> GameState {
    let mut state = GameState::new();
    state.set_board(board_from_json(&render.board));
    state.set_to_move(render.to_move.into());
    state.set_phase(render.phase.into());
    state.set_winner(render.winner.map(|p| p.into()));
    state
}

fn parse_state(json: &str) -> Result<GameState, String> {
    let render = parse_render(json)?;
    Ok(state_from_render(&render))
}

fn to_json<T: Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string(value).map_err(|e| e.to_string())
}

#[wasm_bindgen]
pub fn new_game() -> Result<String, JsValue> {
    to_json(&render_state_from(GameState::new())).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn legal_moves(state_json: &str) -> Result<String, JsValue> {
    let state = parse_state(state_json).map_err(|e| JsValue::from_str(&e))?;
    let moves: Vec<MoveJson> = state
        .legal_moves()
        .into_iter()
        .map(MoveJson::from)
        .collect();
    to_json(&moves).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn apply_move(state_json: &str, move_json: &str) -> Result<String, JsValue> {
    let mut state = parse_state(state_json).map_err(|e| JsValue::from_str(&e))?;
    let move_json: MoveJson =
        serde_json::from_str(move_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let player_move: Move = Move::try_from(move_json).map_err(|e| JsValue::from_str(&e))?;
    state
        .apply(player_move)
        .map_err(|_| JsValue::from_str("illegal move"))?;
    to_json(&render_state_from(state)).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn ai_best_move(state_json: &str, depth: u32) -> Result<String, JsValue> {
    let state = parse_state(state_json).map_err(|e| JsValue::from_str(&e))?;
    let depth = depth.max(1);
    let best = choose_move(&state, depth).ok_or_else(|| JsValue::from_str("no legal move"))?;
    to_json(&MoveJson::from(best)).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn render_state(state_json: &str) -> Result<String, JsValue> {
    let state = parse_state(state_json).map_err(|e| JsValue::from_str(&e))?;
    to_json(&render_state_from(state)).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tzaar::all_playable_coords;

    #[test]
    fn new_game_json_shape() {
        let json = to_json(&render_state_from(GameState::new())).unwrap();
        assert!(json.contains("\"WhiteOpening\""));
        assert!(json.contains("\"legal_moves\""));
        assert!(json.contains("\"stacks\""));
    }

    #[test]
    fn board_roundtrip_preserves_start() {
        let state = GameState::new();
        let render = render_state_from(state.clone());
        let back = state_from_render(&render);
        assert_eq!(back.board().stack(Coord::new(1, 0)).map(|s| s.height()), state.board().stack(Coord::new(1, 0)).map(|s| s.height()));
        assert_eq!(all_playable_coords().len(), 60);
    }
}
