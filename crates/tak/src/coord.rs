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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Direction {
    North,
    East,
    South,
    West,
}

impl Direction {
    pub const ALL: [Self; 4] = [Self::North, Self::East, Self::South, Self::West];

    pub fn delta(self) -> (i8, i8) {
        match self {
            Self::North => (0, -1),
            Self::East => (1, 0),
            Self::South => (0, 1),
            Self::West => (-1, 0),
        }
    }

    pub fn from_to(from: Coord, to: Coord) -> Option<Self> {
        let dx = to.x as i16 - from.x as i16;
        let dy = to.y as i16 - from.y as i16;
        match (dx, dy) {
            (0, d) if d < 0 => Some(Self::North),
            (0, d) if d > 0 => Some(Self::South),
            (d, 0) if d > 0 => Some(Self::East),
            (d, 0) if d < 0 => Some(Self::West),
            _ => None,
        }
    }
}
