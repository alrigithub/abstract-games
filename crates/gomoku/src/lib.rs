mod board;
mod coord;
mod game_state;
mod player;

pub use board::Board;
pub use coord::Coord;
pub use game_state::{GameState, IllegalMove};
pub use player::Player;

pub const BOARD_SIZE: usize = 15;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Move {
    Place(Coord),
}
