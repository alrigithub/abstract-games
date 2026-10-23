mod board;
mod coord;
mod game_state;
mod piece;
mod player;

pub use board::Board;
pub use coord::{Coord, Direction};
pub use game_state::{GameState, IllegalMove, Reserve, check_road_win};
pub use piece::{Stone, StoneKind};
pub use player::Player;

pub const BOARD_SIZE: usize = 5;
pub const FLATS_PER_PLAYER: u8 = 21;
pub const CAPS_PER_PLAYER: u8 = 1;
pub const CARRY_LIMIT: u8 = BOARD_SIZE as u8;
pub const MAX_SLIDE_STEPS: usize = BOARD_SIZE;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Move {
    Place {
        coord: Coord,
        kind: StoneKind,
    },
    Slide {
        from: Coord,
        direction: Direction,
        pickup: u8,
        step_count: u8,
        drops: [u8; MAX_SLIDE_STEPS],
    },
}

impl Move {
    pub fn slide_drops(&self) -> &[u8] {
        match self {
            Move::Slide {
                step_count, drops, ..
            } => &drops[..(*step_count as usize)],
            _ => &[],
        }
    }

    pub fn slide(from: Coord, direction: Direction, pickup: u8, drops: &[u8]) -> Self {
        let mut buf = [0u8; MAX_SLIDE_STEPS];
        buf[..drops.len()].copy_from_slice(drops);
        Self::Slide {
            from,
            direction,
            pickup,
            step_count: drops.len() as u8,
            drops: buf,
        }
    }
}
