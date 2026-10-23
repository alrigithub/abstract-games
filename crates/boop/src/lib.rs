mod board;
mod coord;
mod game_state;
mod piece;
mod player;

pub use board::Board;
pub use coord::Coord;
pub use game_state::{GameState, IllegalMove, Pool, CATS_PER_PLAYER, KITTENS_PER_PLAYER};
pub use piece::{Piece, PieceKind};
pub use player::Player;

pub const BOARD_SIZE: usize = 6;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Move {
    Place {
        coord: Coord,
        piece: PieceKind,
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
    pub fn coord(&self) -> Coord {
        match *self {
            Move::Place { coord, .. }
            | Move::GraduateSingleKitten { coord }
            | Move::ReturnCatToPool { coord } => coord,
        }
    }
}
