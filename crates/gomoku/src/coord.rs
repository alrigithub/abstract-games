use crate::BOARD_SIZE;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Coord {
    pub x: u8,
    pub y: u8,
}

impl Coord {
    pub fn try_new(x: u8, y: u8) -> Option<Self> {
        if (x as usize) < BOARD_SIZE && (y as usize) < BOARD_SIZE {
            Some(Self { x, y })
        } else {
            None
        }
    }

    pub fn new(x: u8, y: u8) -> Self {
        Self::try_new(x, y).expect("coordinate out of board bounds")
    }
}
