use gomoku::{Coord, GameState, Move, Player};
use gomoku_ai::choose_move;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CoordJson {
    x: u8,
    y: u8,
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
    Place { coord: CoordJson },
}

impl From<Move> for MoveJson {
    fn from(m: Move) -> Self {
        match m {
            Move::Place(c) => MoveJson::Place { coord: c.into() },
        }
    }
}

impl TryFrom<MoveJson> for Move {
    type Error = String;

    fn try_from(m: MoveJson) -> Result<Self, Self::Error> {
        Ok(match m {
            MoveJson::Place { coord } => Move::Place(coord.into()),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct RenderState {
    #[serde(flatten)]
    game: GameState,
    legal_moves: Vec<MoveJson>,
    human_turn: bool,
    winning_line: Option<Vec<CoordJson>>,
}

fn parse_state(json: &str) -> Result<GameState, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}

fn render_state_from(state: GameState) -> RenderState {
    let winning_line = state
        .winner
        .and_then(|_| state.last_move)
        .and_then(|c| state.board.winning_line_from_last_move(c))
        .map(|line| line.into_iter().map(CoordJson::from).collect());

    let human_turn = state.to_move == Player::Black && state.winner.is_none();
    let legal_moves: Vec<MoveJson> = if state.winner.is_some() {
        vec![]
    } else {
        state.legal_moves().into_iter().map(MoveJson::from).collect()
    };

    RenderState {
        game: state,
        legal_moves,
        human_turn,
        winning_line,
    }
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
    let moves: Vec<MoveJson> = state.legal_moves().into_iter().map(MoveJson::from).collect();
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
    let best = choose_move(&state, depth).ok_or_else(|| JsValue::from_str("no legal moves"))?;
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

    #[test]
    fn new_game_json_shape() {
        let json = to_json(&render_state_from(GameState::new())).unwrap();
        assert!(json.contains("\"Black\""));
        assert!(json.contains("\"legal_moves\""));
    }
}
