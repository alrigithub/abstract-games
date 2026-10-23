mod board;
mod coord;
mod effects;
mod game_state;
mod piece;
mod player;

pub use board::Board;
pub use coord::Coord;
pub use effects::{LineHighlight, MoveEffects, OffBoardExit, PieceDisplacement};
pub use game_state::{CATS_PER_PLAYER, GameState, IllegalMove, KITTENS_PER_PLAYER, Pool, TurnMode};
pub use piece::{Piece, PieceKind};
pub use player::Player;

pub const BOARD_SIZE: usize = 6;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Move {
    Place {
        coord: Coord,
        piece: PieceKind,
    },
    /// After a placement that completed more than one graduating line: pick the line to
    /// graduate. Only legal while [`TurnMode::ChooseGraduation`] is active.
    Graduate {
        line: [Coord; 3],
    },
    /// When all eight of your pieces are on the bed: remove one kitten (it leaves the
    /// game) and promote one cat from reserve to your pool.
    GraduateSingleKitten {
        coord: Coord,
    },
    /// When the bed is full: return one of your cats from the board to your pool.
    ReturnCatToPool {
        coord: Coord,
    },
}

impl Move {
    /// Representative board cell for the move (the middle cell for a graduation line).
    pub fn coord(&self) -> Coord {
        match *self {
            Move::Place { coord, .. }
            | Move::GraduateSingleKitten { coord }
            | Move::ReturnCatToPool { coord } => coord,
            Move::Graduate { line } => line[1],
        }
    }
}
