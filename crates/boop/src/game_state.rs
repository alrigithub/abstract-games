use crate::board::Board;
use crate::coord::Coord;
use crate::piece::{Piece, PieceKind};
use crate::player::Player;
use crate::Move;

pub const KITTENS_PER_PLAYER: u8 = 8;
pub const CATS_PER_PLAYER: u8 = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Pool {
    pub kittens_in_hand: u8,
    pub cats_in_hand: u8,
    pub cats_in_reserve: u8,
}

impl Pool {
    pub fn new() -> Self {
        Self {
            kittens_in_hand: KITTENS_PER_PLAYER,
            cats_in_hand: 0,
            cats_in_reserve: CATS_PER_PLAYER,
        }
    }

    fn take(&mut self, kind: PieceKind) -> bool {
        match kind {
            PieceKind::Kitten if self.kittens_in_hand > 0 => {
                self.kittens_in_hand -= 1;
                true
            }
            PieceKind::Cat if self.cats_in_hand > 0 => {
                self.cats_in_hand -= 1;
                true
            }
            _ => false,
        }
    }

    fn return_piece(&mut self, piece: Piece) {
        match piece.kind {
            PieceKind::Kitten => self.kittens_in_hand += 1,
            PieceKind::Cat => self.cats_in_hand += 1,
        }
    }

    fn graduate_kittens(&mut self, count: u8) -> bool {
        if self.cats_in_reserve < count {
            return false;
        }
        self.cats_in_hand += count;
        self.cats_in_reserve -= count;
        true
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IllegalMove;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameState {
    board: Board,
    pools: [Pool; 2],
    to_move: Player,
    winner: Option<Player>,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            board: Board::empty(),
            pools: [Pool::new(), Pool::new()],
            to_move: Player::First,
            winner: None,
        }
    }

    pub fn board(&self) -> &Board {
        &self.board
    }

    pub fn pool(&self, player: Player) -> Pool {
        self.pools[pool_index(player)]
    }

    pub fn to_move(&self) -> Player {
        self.to_move
    }

    pub fn winner(&self) -> Option<Player> {
        self.winner
    }

    #[doc(hidden)]
    pub fn set_piece(&mut self, coord: Coord, piece: Piece) {
        self.board.set(coord, piece);
    }

    #[doc(hidden)]
    pub fn set_to_move(&mut self, player: Player) {
        self.to_move = player;
    }

    #[doc(hidden)]
    pub fn set_pool(&mut self, player: Player, pool: Pool) {
        self.pools[pool_index(player)] = pool;
    }

    pub fn legal_moves(&self) -> Vec<Move> {
        if self.winner.is_some() {
            return Vec::new();
        }
        let player = self.to_move;
        let pool = self.pool(player);
        let on_board = self.board.count_pieces(player);
        if on_board >= 8 {
            return Vec::new();
        }

        let mut moves = Vec::new();
        for coord in self.board.empty_coords() {
            if pool.kittens_in_hand > 0 {
                moves.push(Move {
                    coord,
                    piece: PieceKind::Kitten,
                });
            }
            if pool.cats_in_hand > 0 {
                moves.push(Move {
                    coord,
                    piece: PieceKind::Cat,
                });
            }
        }
        moves
    }

    pub fn apply(&mut self, player_move: Move) -> Result<(), IllegalMove> {
        if self.winner.is_some() {
            return Err(IllegalMove);
        }

        let Move { coord, piece: kind } = player_move;
        if Coord::try_new(coord.x, coord.y).is_none() || !self.board.is_empty(coord) {
            return Err(IllegalMove);
        }

        let player = self.to_move;
        if !self.pools[pool_index(player)].take(kind) {
            return Err(IllegalMove);
        }
        if self.board.count_pieces(player) >= 8 {
            self.pools[pool_index(player)].return_piece(Piece { player, kind });
            return Err(IllegalMove);
        }

        let placed = Piece { player, kind };
        self.board.set(coord, placed);
        resolve_boops(&mut self.board, coord, placed, &mut self.pools);
        resolve_graduation(self, player);
        if self.winner.is_none() && check_win(&self.board, player) {
            self.winner = Some(player);
        }

        if self.winner.is_none() {
            self.to_move = player.opponent();
        }
        Ok(())
    }
}

fn pool_index(player: Player) -> usize {
    match player {
        Player::First => 0,
        Player::Second => 1,
    }
}

const DIRECTIONS: [(i8, i8); 8] = [
    (0, -1),
    (1, -1),
    (1, 0),
    (1, 1),
    (0, 1),
    (-1, 1),
    (-1, 0),
    (-1, -1),
];

fn resolve_boops(board: &mut Board, placed_at: Coord, placed: Piece, pools: &mut [Pool; 2]) {
    for (dx, dy) in DIRECTIONS {
        let Some(adj) = placed_at.step(dx, dy) else {
            continue;
        };
        let Some(piece) = board.get(adj) else {
            continue;
        };
        if adj == placed_at {
            continue;
        }
        if placed.kind == PieceKind::Kitten && piece.kind == PieceKind::Cat {
            continue;
        }

        let push_dir = (dx, dy);
        let Some(target) = adj.step(push_dir.0, push_dir.1) else {
            board.clear(adj);
            pools[pool_index(piece.player)].return_piece(piece);
            continue;
        };

        if board.get(target).is_some() {
            continue;
        }

        board.clear(adj);
        board.set(target, piece);
    }
}

fn resolve_graduation(state: &mut GameState, player: Player) {
    if let Some(line) = find_kitten_line_of_three(&state.board, player) {
        for coord in line {
            state.board.clear(coord);
        }
        let _ = state.pools[pool_index(player)].graduate_kittens(3);
    }
}

fn find_kitten_line_of_three(board: &Board, player: Player) -> Option<[Coord; 3]> {
    let line_dirs = [(1, 0), (0, 1), (1, 1), (1, -1)];

    for y in 0..crate::BOARD_SIZE as u8 {
        for x in 0..crate::BOARD_SIZE as u8 {
            let start = Coord { x, y };
            for (dx, dy) in line_dirs {
                let cells = [
                    start,
                    start.step(dx, dy)?,
                    start.step(dx * 2, dy * 2)?,
                ];
                if cells.iter().all(|coord| {
                    board
                        .get(*coord)
                        .is_some_and(|p| p.player == player && p.kind == PieceKind::Kitten)
                }) {
                    return Some(cells);
                }
            }
        }
    }
    None
}

fn find_cat_line_of_three(board: &Board, player: Player) -> bool {
    let line_dirs = [(1, 0), (0, 1), (1, 1), (1, -1)];

    for y in 0..crate::BOARD_SIZE as u8 {
        for x in 0..crate::BOARD_SIZE as u8 {
            let start = Coord { x, y };
            for (dx, dy) in line_dirs {
                let Some(a) = start.step(dx, dy) else { continue };
                let Some(b) = start.step(dx * 2, dy * 2) else { continue };
                let line = [start, a, b];
                if line.iter().all(|coord| {
                    board
                        .get(*coord)
                        .is_some_and(|p| p.player == player && p.kind == PieceKind::Cat)
                }) {
                    return true;
                }
            }
        }
    }
    false
}

fn check_win(board: &Board, player: Player) -> bool {
    find_cat_line_of_three(board, player) || board.count_cats(player) >= 8
}

impl Default for GameState {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for Pool {
    fn default() -> Self {
        Self::new()
    }
}
