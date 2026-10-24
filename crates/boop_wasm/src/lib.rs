use boop::{
    Coord, GameState, Move, MoveEffects, Piece, PieceKind, Player, Pool, TurnMode, BOARD_SIZE,
};
use boop_ai::choose_move;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct BoopGame {
    state: GameState,
}

#[derive(Serialize, Deserialize)]
struct PoolDto {
    kittens_in_hand: u8,
    cats_in_hand: u8,
    cats_in_reserve: u8,
}

#[derive(Serialize, Deserialize, Clone)]
struct PieceDto {
    player: String,
    kind: String,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum MoveDto {
    Place { x: u8, y: u8, piece: String },
    Graduate { line: [[u8; 2]; 3] },
    GraduateSingleKitten { x: u8, y: u8 },
    ReturnCatToPool { x: u8, y: u8 },
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum TurnModeDto {
    Place,
    AlternateGraduation,
    ChooseGraduation { lines: Vec<[[u8; 2]; 3]> },
}

#[derive(Serialize, Deserialize)]
struct CoordPair {
    x: u8,
    y: u8,
}

#[derive(Serialize, Deserialize)]
struct DisplacementDto {
    from: CoordPair,
    to: CoordPair,
    player: String,
    kind: String,
}

#[derive(Serialize, Deserialize)]
struct OffBoardDto {
    from: CoordPair,
    player: String,
    kind: String,
    push_x: i8,
    push_y: i8,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum LineHighlightDto {
    Graduation { line: [[u8; 2]; 3] },
    Win { line: [[u8; 2]; 3] },
    EightCatsOnBed,
}

#[derive(Serialize, Deserialize)]
struct EffectsDto {
    displacements: Vec<DisplacementDto>,
    off_board: Vec<OffBoardDto>,
    line_highlight: Option<LineHighlightDto>,
    graduated_cells: Option<[[u8; 2]; 3]>,
}

#[derive(Serialize, Deserialize)]
struct GameView {
    to_move: String,
    winner: Option<String>,
    turn_mode: TurnModeDto,
    board: Vec<Vec<Option<PieceDto>>>,
    pools: [PoolDto; 2],
    effects: EffectsDto,
}

#[derive(Serialize, Deserialize)]
struct PersistedState {
    board: Vec<Vec<Option<PieceDto>>>,
    pools: [PoolDto; 2],
    to_move: String,
    winner: Option<String>,
    pending_graduation: Vec<[[u8; 2]; 3]>,
}

fn player_to_id(p: Player) -> &'static str {
    match p {
        Player::First => "A",
        Player::Second => "B",
    }
}

fn id_to_player(id: &str) -> Option<Player> {
    match id {
        "A" => Some(Player::First),
        "B" => Some(Player::Second),
        _ => None,
    }
}

fn kind_to_str(k: PieceKind) -> &'static str {
    match k {
        PieceKind::Kitten => "kitten",
        PieceKind::Cat => "cat",
    }
}

fn str_to_kind(s: &str) -> Option<PieceKind> {
    match s {
        "kitten" => Some(PieceKind::Kitten),
        "cat" => Some(PieceKind::Cat),
        _ => None,
    }
}

fn pool_to_dto(p: Pool) -> PoolDto {
    PoolDto {
        kittens_in_hand: p.kittens_in_hand,
        cats_in_hand: p.cats_in_hand,
        cats_in_reserve: p.cats_in_reserve,
    }
}

fn dto_to_pool(d: &PoolDto) -> Pool {
    Pool {
        kittens_in_hand: d.kittens_in_hand,
        cats_in_hand: d.cats_in_hand,
        cats_in_reserve: d.cats_in_reserve,
    }
}

fn piece_to_dto(p: Piece) -> PieceDto {
    PieceDto {
        player: player_to_id(p.player).to_string(),
        kind: kind_to_str(p.kind).to_string(),
    }
}

fn dto_to_piece(d: &PieceDto) -> Option<Piece> {
    Some(Piece {
        player: id_to_player(&d.player)?,
        kind: str_to_kind(&d.kind)?,
    })
}

fn coord_pair(c: Coord) -> CoordPair {
    CoordPair { x: c.x, y: c.y }
}

fn line_to_array(line: [Coord; 3]) -> [[u8; 2]; 3] {
    [coord_array(line[0]), coord_array(line[1]), coord_array(line[2])]
}

fn coord_array(c: Coord) -> [u8; 2] {
    [c.x, c.y]
}

fn array_to_coord(pair: [u8; 2]) -> Option<Coord> {
    Coord::try_new(pair[0], pair[1])
}

fn array_to_line(line: [[u8; 2]; 3]) -> Option<[Coord; 3]> {
    Some([
        array_to_coord(line[0])?,
        array_to_coord(line[1])?,
        array_to_coord(line[2])?,
    ])
}

fn turn_mode_dto(state: &GameState) -> TurnModeDto {
    match state.turn_mode() {
        TurnMode::Place => TurnModeDto::Place,
        TurnMode::AlternateGraduation => TurnModeDto::AlternateGraduation,
        TurnMode::ChooseGraduation(lines) => TurnModeDto::ChooseGraduation {
            lines: lines.iter().map(|l| line_to_array(*l)).collect(),
        },
    }
}

fn highlight_dto(h: &boop::LineHighlight) -> LineHighlightDto {
    match *h {
        boop::LineHighlight::Graduation(line) => LineHighlightDto::Graduation {
            line: line_to_array(line),
        },
        boop::LineHighlight::Win(line) => LineHighlightDto::Win {
            line: line_to_array(line),
        },
        boop::LineHighlight::EightCatsOnBed => LineHighlightDto::EightCatsOnBed,
    }
}

fn effects_dto(e: &MoveEffects) -> EffectsDto {
    EffectsDto {
        displacements: e
            .displacements
            .iter()
            .map(|d| DisplacementDto {
                from: coord_pair(d.from),
                to: coord_pair(d.to),
                player: player_to_id(d.piece.player).to_string(),
                kind: kind_to_str(d.piece.kind).to_string(),
            })
            .collect(),
        off_board: e
            .off_board
            .iter()
            .map(|o| OffBoardDto {
                from: coord_pair(o.from),
                player: player_to_id(o.piece.player).to_string(),
                kind: kind_to_str(o.piece.kind).to_string(),
                push_x: o.push.0,
                push_y: o.push.1,
            })
            .collect(),
        line_highlight: e.line_highlight.as_ref().map(highlight_dto),
        graduated_cells: e.graduated_cells.map(line_to_array),
    }
}

fn build_view(state: &GameState) -> GameView {
    let mut board = Vec::with_capacity(BOARD_SIZE);
    for y in 0..BOARD_SIZE {
        let mut row = Vec::with_capacity(BOARD_SIZE);
        for x in 0..BOARD_SIZE {
            let coord = Coord::new(x as u8, y as u8);
            row.push(state.board().get(coord).map(piece_to_dto));
        }
        board.push(row);
    }
    let pools = [
        pool_to_dto(state.pool(Player::First)),
        pool_to_dto(state.pool(Player::Second)),
    ];
    GameView {
        to_move: player_to_id(state.to_move()).to_string(),
        winner: state.winner().map(|p| player_to_id(p).to_string()),
        turn_mode: turn_mode_dto(state),
        board,
        pools,
        effects: effects_dto(state.last_move_effects()),
    }
}

fn move_to_dto(m: &Move) -> MoveDto {
    match *m {
        Move::Place { coord, piece } => MoveDto::Place {
            x: coord.x,
            y: coord.y,
            piece: kind_to_str(piece).to_string(),
        },
        Move::Graduate { line } => MoveDto::Graduate {
            line: line_to_array(line),
        },
        Move::GraduateSingleKitten { coord } => MoveDto::GraduateSingleKitten {
            x: coord.x,
            y: coord.y,
        },
        Move::ReturnCatToPool { coord } => MoveDto::ReturnCatToPool {
            x: coord.x,
            y: coord.y,
        },
    }
}

fn dto_to_move(d: MoveDto) -> Option<Move> {
    Some(match d {
        MoveDto::Place { x, y, piece } => Move::Place {
            coord: Coord::try_new(x, y)?,
            piece: str_to_kind(&piece)?,
        },
        MoveDto::Graduate { line } => Move::Graduate {
            line: array_to_line(line)?,
        },
        MoveDto::GraduateSingleKitten { x, y } => Move::GraduateSingleKitten {
            coord: Coord::try_new(x, y)?,
        },
        MoveDto::ReturnCatToPool { x, y } => Move::ReturnCatToPool {
            coord: Coord::try_new(x, y)?,
        },
    })
}

fn persist(state: &GameState) -> PersistedState {
    let mut board = Vec::with_capacity(BOARD_SIZE);
    for y in 0..BOARD_SIZE {
        let mut row = Vec::with_capacity(BOARD_SIZE);
        for x in 0..BOARD_SIZE {
            let coord = Coord::new(x as u8, y as u8);
            row.push(state.board().get(coord).map(piece_to_dto));
        }
        board.push(row);
    }
    PersistedState {
        board,
        pools: [
            pool_to_dto(state.pool(Player::First)),
            pool_to_dto(state.pool(Player::Second)),
        ],
        to_move: player_to_id(state.to_move()).to_string(),
        winner: state.winner().map(|p| player_to_id(p).to_string()),
        pending_graduation: state
            .pending_graduation_lines()
            .iter()
            .map(|l| line_to_array(*l))
            .collect(),
    }
}

fn restore_full(data: PersistedState) -> Result<BoopGame, String> {
    let mut state = GameState::new();
    for (y, row) in data.board.iter().enumerate() {
        for (x, cell) in row.iter().enumerate() {
            if let Some(dto) = cell {
                let piece = dto_to_piece(dto).ok_or("invalid piece")?;
                state.set_piece(Coord::new(x as u8, y as u8), piece);
            }
        }
    }
    state.set_pool(Player::First, dto_to_pool(&data.pools[0]));
    state.set_pool(Player::Second, dto_to_pool(&data.pools[1]));
    let to_move = id_to_player(&data.to_move).ok_or("invalid to_move")?;
    state.set_to_move(to_move);
    state.set_winner(data.winner.as_deref().and_then(id_to_player));
    let pending: Result<Vec<[Coord; 3]>, String> = data
        .pending_graduation
        .iter()
        .map(|l| array_to_line(*l).ok_or_else(|| "bad line".into()))
        .collect();
    state.set_pending_graduation(pending?);
    Ok(BoopGame { state })
}

#[wasm_bindgen]
impl BoopGame {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            state: GameState::new(),
        }
    }

    pub fn view_json(&self) -> String {
        serde_json::to_string(&build_view(&self.state)).unwrap_or_else(|_| "{}".into())
    }

    pub fn export_state(&self) -> String {
        serde_json::to_string(&persist(&self.state)).unwrap_or_else(|_| "{}".into())
    }

    pub fn import_state(json: &str) -> Result<BoopGame, JsValue> {
        let data: PersistedState =
            serde_json::from_str(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        restore_full(data).map_err(|e| JsValue::from_str(&e))
    }

    pub fn apply_move_json(&mut self, json: &str) -> Result<String, JsValue> {
        let dto: MoveDto = serde_json::from_str(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let player_move =
            dto_to_move(dto).ok_or_else(|| JsValue::from_str("invalid move"))?;
        self.state
            .apply(player_move)
            .map_err(|_| JsValue::from_str("illegal move"))?;
        Ok(self.view_json())
    }

    pub fn move_for_interaction_json(
        &self,
        player: &str,
        x: u8,
        y: u8,
        preferred: &str,
    ) -> Option<String> {
        let player = id_to_player(player)?;
        let coord = Coord::try_new(x, y)?;
        let preferred = str_to_kind(preferred)?;
        let mv = self
            .state
            .move_for_interaction(player, coord, preferred)?;
        serde_json::to_string(&move_to_dto(&mv)).ok()
    }

    pub fn choose_ai_move(&self, max_depth: u32) -> Option<String> {
        if self.state.to_move() != Player::Second {
            return None;
        }
        let mv = choose_move(&self.state, max_depth)?;
        serde_json::to_string(&move_to_dto(&mv)).ok()
    }

    pub fn legal_moves_json(&self) -> String {
        let moves: Vec<MoveDto> = self.state.legal_moves().iter().map(move_to_dto).collect();
        serde_json::to_string(&moves).unwrap_or_else(|_| "[]".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_new_game() {
        let game = BoopGame::new();
        let exported = game.export_state();
        let restored = BoopGame::import_state(&exported).unwrap();
        assert_eq!(game.view_json(), restored.view_json());
    }
}
