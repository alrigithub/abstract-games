use crate::BOARD_SIZE;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
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

    pub fn step(self, dx: i8, dy: i8) -> Option<Self> {
        let x = self.x as i16 + dx as i16;
        let y = self.y as i16 + dy as i16;
        if x >= 0 && y >= 0 && (x as usize) < BOARD_SIZE && (y as usize) < BOARD_SIZE {
            Some(Self {
                x: x as u8,
                y: y as u8,
            })
        } else {
            None
        }
    }
}
