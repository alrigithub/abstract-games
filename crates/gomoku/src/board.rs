use crate::coord::Coord;
use crate::player::Player;
use crate::BOARD_SIZE;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Board {
    cells: [[Option<Player>; BOARD_SIZE]; BOARD_SIZE],
}

impl Board {
    pub fn empty() -> Self {
        Self {
            cells: [[None; BOARD_SIZE]; BOARD_SIZE],
        }
    }

    pub fn get(&self, coord: Coord) -> Option<Player> {
        self.cells[coord.y as usize][coord.x as usize]
    }

    pub fn set(&mut self, coord: Coord, player: Player) {
        self.cells[coord.y as usize][coord.x as usize] = Some(player);
    }

    pub fn clear(&mut self, coord: Coord) {
        self.cells[coord.y as usize][coord.x as usize] = None;
    }

    pub fn is_full(&self) -> bool {
        self.cells
            .iter()
            .flatten()
            .all(|cell| cell.is_some())
    }

    /// Returns the winner if `coord` completes five or more in a row for that stone's owner.
    pub fn winner_from_last_move(&self, coord: Coord) -> Option<Player> {
        self.winning_line_from_last_move(coord)
            .map(|_| self.get(coord).expect("stone at last move"))
    }

    /// Exactly five (or more) in a row through `coord`; returns five intersections for VFX.
    pub fn winning_line_from_last_move(&self, coord: Coord) -> Option<Vec<Coord>> {
        let player = self.get(coord)?;
        const DIRECTIONS: [(i8, i8); 4] = [(1, 0), (0, 1), (1, 1), (1, -1)];

        for (dx, dy) in DIRECTIONS {
            let back = self.count_along(coord, player, -dx, -dy);
            let fwd = self.count_along(coord, player, dx, dy);
            if 1 + back + fwd >= 5 {
                let mut x = coord.x as i16 - back as i16 * dx as i16;
                let mut y = coord.y as i16 - back as i16 * dy as i16;
                let mut line = Vec::with_capacity(5);
                for _ in 0..5 {
                    line.push(Coord {
                        x: x as u8,
                        y: y as u8,
                    });
                    x += dx as i16;
                    y += dy as i16;
                }
                return Some(line);
            }
        }
        None
    }

    fn count_along(&self, start: Coord, player: Player, dx: i8, dy: i8) -> u32 {
        let mut count = 0;
        let mut x = start.x as i16 + dx as i16;
        let mut y = start.y as i16 + dy as i16;

        while x >= 0
            && y >= 0
            && (x as usize) < BOARD_SIZE
            && (y as usize) < BOARD_SIZE
        {
            let coord = Coord {
                x: x as u8,
                y: y as u8,
            };
            if self.get(coord) != Some(player) {
                break;
            }
            count += 1;
            x += dx as i16;
            y += dy as i16;
        }
        count
    }

    pub fn empty_coords(&self) -> impl Iterator<Item = Coord> + '_ {
        (0..BOARD_SIZE as u8).flat_map(move |y| {
            (0..BOARD_SIZE as u8).filter_map(move |x| {
                let coord = Coord { x, y };
                if self.get(coord).is_none() {
                    Some(coord)
                } else {
                    None
                }
            })
        })
    }
}
