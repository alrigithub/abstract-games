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
pub struct Move {
    pub coord: Coord,
    pub piece: PieceKind,
}
