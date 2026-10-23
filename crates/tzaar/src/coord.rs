use std::fmt;

/// Cell on the 9×9 sloped grid (see `board::is_playable`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Coord {
    pub x: i8,
    pub y: i8,
}

impl Coord {
    pub const fn new(x: i8, y: i8) -> Self {
        Self { x, y }
    }

    pub fn index(self) -> Option<usize> {
        if self.x < 0 || self.x >= 9 || self.y < 0 || self.y >= 9 {
            return None;
        }
        Some((self.y as usize) * 9 + self.x as usize)
    }
}

impl fmt::Display for Coord {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({},{})", self.x, self.y)
    }
}

/// Six slide directions on the Tzaar grid (official rules / Waltz board).
pub const DIRECTIONS: [(i8, i8); 6] = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)];

pub fn step(coord: Coord, (dx, dy): (i8, i8)) -> Coord {
    Coord::new(coord.x + dx, coord.y + dy)
}
