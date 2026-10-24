use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use yinsh::{Coord, GameState, Move, Player, TurnMode};
use yinsh_ai::{get_ai_move, possible_moves};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CoordJson {
    x: i8,
    y: i8,
}

impl From<Coord> for CoordJson {
    fn from(c: Coord) -> Self {
        Self { x: c.x, y: c.y }
    }
}

impl From<CoordJson> for Coord {
    fn from(c: CoordJson) -> Self {
        Coord { x: c.x, y: c.y }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum MoveJson {
    PlaceRing { coord: CoordJson },
    PlaceMarker { coord: CoordJson },
    MoveRing { start: CoordJson, end: CoordJson },
    RemoveRun { seed: CoordJson },
    RemoveRing { coord: CoordJson },
    Wait,
}

impl From<Move> for MoveJson {
    fn from(m: Move) -> Self {
        match m {
            Move::PlaceRing(c) => MoveJson::PlaceRing { coord: c.into() },
            Move::PlaceMarker(c) => MoveJson::PlaceMarker { coord: c.into() },
            Move::MoveRing(a, b) => MoveJson::MoveRing {
                start: a.into(),
                end: b.into(),
            },
            Move::RemoveRun(c) => MoveJson::RemoveRun { seed: c.into() },
            Move::RemoveRing(c) => MoveJson::RemoveRing { coord: c.into() },
            Move::Wait => MoveJson::Wait,
        }
    }
}

impl TryFrom<MoveJson> for Move {
    type Error = String;

    fn try_from(m: MoveJson) -> Result<Self, Self::Error> {
        Ok(match m {
            MoveJson::PlaceRing { coord } => Move::PlaceRing(coord.into()),
            MoveJson::PlaceMarker { coord } => Move::PlaceMarker(coord.into()),
            MoveJson::MoveRing { start, end } => Move::MoveRing(start.into(), end.into()),
            MoveJson::RemoveRun { seed } => Move::RemoveRun(seed.into()),
            MoveJson::RemoveRing { coord } => Move::RemoveRing(coord.into()),
            MoveJson::Wait => Move::Wait,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct RenderState {
    #[serde(flatten)]
    game: GameState,
    winner: Option<Player>,
    legal_moves: Vec<MoveJson>,
    human_turn: bool,
    auto_wait: bool,
}

fn parse_state(json: &str) -> Result<GameState, String> {
    let mut state: GameState = serde_json::from_str(json).map_err(|e| e.to_string())?;
    state.board.fill_board_from_lists();
    Ok(state)
}

fn render_state_from(state: GameState) -> RenderState {
    let winner = state.winner();
    let human_turn = state.active_player == Player::A && winner.is_none();
    let auto_wait = matches!(
        state.turn_mode,
        TurnMode::WaitForRingMovement(_)
            | TurnMode::WaitForRunRemoval(_)
            | TurnMode::WaitForRingRemoval(_)
            | TurnMode::WaitForMarkerPlacement
    );
    let legal_moves: Vec<MoveJson> = if winner.is_some() {
        vec![]
    } else {
        possible_moves(&state).map(MoveJson::from).collect()
    };

    RenderState {
        game: state,
        winner,
        legal_moves,
        human_turn,
        auto_wait,
    }
}

fn to_json<T: Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string(value).map_err(|e| e.to_string())
}

#[wasm_bindgen]
pub fn new_game() -> Result<String, JsValue> {
    to_json(&render_state_from(GameState::initial())).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn legal_moves(state_json: &str) -> Result<String, JsValue> {
    let state = parse_state(state_json).map_err(|e| JsValue::from_str(&e))?;
    let moves: Vec<MoveJson> = possible_moves(&state).map(MoveJson::from).collect();
    to_json(&moves).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn apply_move(state_json: &str, move_json: &str) -> Result<String, JsValue> {
    let mut state = parse_state(state_json).map_err(|e| JsValue::from_str(&e))?;
    let move_json: MoveJson =
        serde_json::from_str(move_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let player_move: Move = Move::try_from(move_json).map_err(|e| JsValue::from_str(&e))?;
    state.perform_move(&player_move);
    to_json(&render_state_from(state)).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn ai_best_move(state_json: &str, depth: u32) -> Result<String, JsValue> {
    let state = parse_state(state_json).map_err(|e| JsValue::from_str(&e))?;
    let depth = depth as usize;
    let best = get_ai_move(depth.max(1), &state);
    to_json(&MoveJson::from(best)).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn render_state(state_json: &str) -> Result<String, JsValue> {
    let state = parse_state(state_json).map_err(|e| JsValue::from_str(&e))?;
    to_json(&render_state_from(state)).map_err(|e| JsValue::from_str(&e))
}

/// Click-outside cancel while moving a ring (mirrors Bevy `CancelRingSelectionEvent`).
#[wasm_bindgen]
pub fn cancel_ring_selection(state_json: &str) -> Result<String, JsValue> {
    let mut state = parse_state(state_json).map_err(|e| JsValue::from_str(&e))?;
    if let TurnMode::RingMovement(start) = state.turn_mode {
        state.turn_mode = TurnMode::WaitForRingMovement(start);
    }
    to_json(&render_state_from(state)).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_game_json_shape() {
        let json = to_json(&render_state_from(GameState::initial())).unwrap();
        assert!(json.contains("\"RingPlacement\""));
        assert!(json.contains("\"legal_moves\""));
    }
}
