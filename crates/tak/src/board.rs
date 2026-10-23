use crate::BOARD_SIZE;
use crate::coord::Coord;
use crate::piece::Stone;
use crate::player::Player;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Board {
    stacks: [[Vec<Stone>; BOARD_SIZE]; BOARD_SIZE],
}

impl Board {
    pub fn empty() -> Self {
        Self {
            stacks: std::array::from_fn(|_| std::array::from_fn(|_| Vec::new())),
        }
    }

    pub fn stack(&self, coord: Coord) -> &[Stone] {
        &self.stacks[coord.y as usize][coord.x as usize]
    }

    pub fn stack_mut(&mut self, coord: Coord) -> &mut Vec<Stone> {
        &mut self.stacks[coord.y as usize][coord.x as usize]
    }

    pub fn is_empty(&self, coord: Coord) -> bool {
        self.stack(coord).is_empty()
    }

    pub fn top(&self, coord: Coord) -> Option<Stone> {
        self.stack(coord).last().copied()
    }

    pub fn controlled_by(&self, coord: Coord) -> Option<Player> {
        self.top(coord).map(|s| s.owner)
    }

    pub fn count_owned_from_top(&self, coord: Coord, player: Player) -> u8 {
        let stack = self.stack(coord);
        let mut count = 0u8;
        for stone in stack.iter().rev() {
            if stone.owner == player {
                count += 1;
            } else {
                break;
            }
        }
        count
    }

    pub fn empty_coords(&self) -> Vec<Coord> {
        let mut coords = Vec::new();
        for y in 0..BOARD_SIZE as u8 {
            for x in 0..BOARD_SIZE as u8 {
                let coord = Coord { x, y };
                if self.is_empty(coord) {
                    coords.push(coord);
                }
            }
        }
        coords
    }

    pub fn place_on_empty(&mut self, coord: Coord, stone: Stone) -> bool {
        if !self.is_empty(coord) {
            return false;
        }
        self.stack_mut(coord).push(stone);
        true
    }

    pub fn push_on_stack(&mut self, coord: Coord, stone: Stone) -> bool {
        if self.top(coord).is_some_and(|top| top.blocks_stack_on_top()) {
            return false;
        }
        self.stack_mut(coord).push(stone);
        true
    }

    pub fn flatten_wall(&mut self, coord: Coord, new_owner: Player) {
        let stack = self.stack_mut(coord);
        if let Some(top) = stack.last_mut()
            && top.kind == crate::piece::StoneKind::Wall
        {
            top.kind = crate::piece::StoneKind::Flat;
            top.owner = new_owner;
        }
    }
}
