use crate::Move;
use crate::board::Board;
use crate::coord::{Coord, Direction};
use crate::piece::{Stone, StoneKind};
use crate::player::Player;
use crate::{CAPS_PER_PLAYER, CARRY_LIMIT, FLATS_PER_PLAYER};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IllegalMove;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Reserve {
    pub flats: u8,
    pub cap: u8,
}

impl Reserve {
    pub fn new() -> Self {
        Self {
            flats: FLATS_PER_PLAYER,
            cap: CAPS_PER_PLAYER,
        }
    }

    fn take(&mut self, kind: StoneKind) -> bool {
        match kind {
            StoneKind::Flat | StoneKind::Wall => {
                if self.flats > 0 {
                    self.flats -= 1;
                    true
                } else {
                    false
                }
            }
            StoneKind::Cap => {
                if self.cap > 0 {
                    self.cap -= 1;
                    true
                } else {
                    false
                }
            }
        }
    }
}

const OPENING_PLACEMENTS: u8 = 2;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameState {
    board: Board,
    reserves: [Reserve; 2],
    to_move: Player,
    placement_phase: bool,
    opening_placements: u8,
    winner: Option<Player>,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            board: Board::empty(),
            reserves: [Reserve::new(), Reserve::new()],
            to_move: Player::First,
            placement_phase: true,
            opening_placements: 0,
            winner: None,
        }
    }

    pub fn board(&self) -> &Board {
        &self.board
    }

    pub fn reserve(&self, player: Player) -> Reserve {
        self.reserves[pool_index(player)]
    }

    pub fn to_move(&self) -> Player {
        self.to_move
    }

    pub fn placement_phase(&self) -> bool {
        self.placement_phase
    }

    pub fn opening_placements(&self) -> u8 {
        self.opening_placements
    }

    pub fn winner(&self) -> Option<Player> {
        self.winner
    }

    #[doc(hidden)]
    pub fn set_stack(&mut self, coord: Coord, stack: Vec<Stone>) {
        *self.board.stack_mut(coord) = stack;
    }

    #[doc(hidden)]
    pub fn set_reserve(&mut self, player: Player, reserve: Reserve) {
        self.reserves[pool_index(player)] = reserve;
    }

    #[doc(hidden)]
    pub fn set_to_move(&mut self, player: Player) {
        self.to_move = player;
    }

    #[doc(hidden)]
    pub fn set_placement_phase(&mut self, placement: bool) {
        self.placement_phase = placement;
    }

    pub fn slide_to(&self, from: Coord, to: Coord) -> Option<Move> {
        if from == to {
            return None;
        }
        let mut matches: Vec<Move> = self
            .legal_moves()
            .into_iter()
            .filter(|m| {
                let Move::Slide { from: f, .. } = m else {
                    return false;
                };
                *f == from && slide_move_touches(*m, from, to)
            })
            .collect();
        if matches.is_empty() {
            return None;
        }
        matches.sort_by_key(|m| slide_to_match_priority(*m, from, to));
        Some(matches[0])
    }

    pub fn legal_moves(&self) -> Vec<Move> {
        if self.winner.is_some() {
            return Vec::new();
        }
        let mut moves = Vec::new();
        if self.placement_phase {
            let opponent = self.to_move.opponent();
            if self.reserves[pool_index(opponent)].flats > 0 {
                for coord in self.board.empty_coords() {
                    moves.push(Move::Place {
                        coord,
                        kind: StoneKind::Flat,
                    });
                }
            }
        } else {
            moves.extend(self.legal_placements());
            moves.extend(self.legal_slides());
        }
        moves
    }

    fn legal_placements(&self) -> Vec<Move> {
        let player = self.to_move;
        let reserve = self.reserve(player);
        let mut moves = Vec::new();
        for coord in self.board.empty_coords() {
            if reserve.flats > 0 {
                moves.push(Move::Place {
                    coord,
                    kind: StoneKind::Flat,
                });
                moves.push(Move::Place {
                    coord,
                    kind: StoneKind::Wall,
                });
            }
            if reserve.cap > 0 {
                moves.push(Move::Place {
                    coord,
                    kind: StoneKind::Cap,
                });
            }
        }
        moves
    }

    fn legal_slides(&self) -> Vec<Move> {
        let player = self.to_move;
        let mut moves = Vec::new();
        for y in 0..crate::BOARD_SIZE as u8 {
            for x in 0..crate::BOARD_SIZE as u8 {
                let from = Coord { x, y };
                if self.board.controlled_by(from) != Some(player) {
                    continue;
                }
                let owned = self.board.count_owned_from_top(from, player);
                if owned == 0 {
                    continue;
                }
                let max_pickup = owned.min(CARRY_LIMIT);
                for pickup in 1..=max_pickup {
                    for direction in Direction::ALL {
                        moves.extend(slide_variants(self, from, direction, pickup));
                    }
                }
            }
        }
        moves
    }

    pub fn apply(&mut self, player_move: Move) -> Result<(), IllegalMove> {
        if self.winner.is_some() {
            return Err(IllegalMove);
        }
        if !self.legal_moves().contains(&player_move) {
            return Err(IllegalMove);
        }

        let mover = self.to_move;

        match player_move {
            Move::Place { coord, kind } => self.apply_place(coord, kind)?,
            Move::Slide {
                from,
                direction,
                pickup,
                ..
            } => self.apply_slide(from, direction, pickup, player_move.slide_drops())?,
        }

        if self.winner.is_none() {
            if let Some(winner) = check_road_win(&self.board, mover) {
                self.winner = Some(winner);
            } else if self.placement_phase == false
                && let Some(winner) = check_flat_win(&self.board, &self.reserves)
            {
                self.winner = Some(winner);
            }
        }

        if self.winner.is_none() {
            self.to_move = self.to_move.opponent();
        }
        Ok(())
    }

    fn apply_place(&mut self, coord: Coord, kind: StoneKind) -> Result<(), IllegalMove> {
        if !self.board.is_empty(coord) {
            return Err(IllegalMove);
        }
        if self.placement_phase {
            if kind != StoneKind::Flat {
                return Err(IllegalMove);
            }
        } else if kind == StoneKind::Wall || kind == StoneKind::Cap {
            // allowed in move phase only
        }

        let (reserve_owner, stone_owner) = if self.placement_phase {
            (self.to_move.opponent(), self.to_move.opponent())
        } else {
            (self.to_move, self.to_move)
        };

        if !self.reserves[pool_index(reserve_owner)].take(kind) {
            return Err(IllegalMove);
        }

        let stone = Stone {
            owner: stone_owner,
            kind,
        };
        if !self.board.place_on_empty(coord, stone) {
            return Err(IllegalMove);
        }

        if self.placement_phase {
            self.opening_placements += 1;
            if self.opening_placements >= OPENING_PLACEMENTS {
                self.placement_phase = false;
            }
        }
        Ok(())
    }

    fn apply_slide(
        &mut self,
        from: Coord,
        direction: Direction,
        pickup: u8,
        drops: &[u8],
    ) -> Result<(), IllegalMove> {
        self.placement_phase = false;

        let player = self.to_move;
        let height = self.board.stack(from).len();
        let pickup = pickup as usize;
        if pickup == 0 || pickup > height || pickup > CARRY_LIMIT as usize {
            return Err(IllegalMove);
        }
        if self.board.count_owned_from_top(from, player) < pickup as u8 {
            return Err(IllegalMove);
        }

        let leave = height - pickup;
        let (dx, dy) = direction.delta();
        let steps = drops.len();
        if steps == 0 {
            return Err(IllegalMove);
        }

        let mut path = Vec::with_capacity(steps + 1);
        let mut coord = from;
        path.push(from);
        for _ in 0..steps {
            coord = coord.step(dx, dy).ok_or(IllegalMove)?;
            path.push(coord);
        }

        if drops.contains(&0) || drops.iter().sum::<u8>() != pickup as u8 {
            return Err(IllegalMove);
        }

        let stack = self.board.stack(from);
        let mut hand: Vec<Stone> = stack[(height - pickup)..].to_vec();
        *self.board.stack_mut(from) = stack[..(height - pickup)].to_vec();

        for (idx, (&drop_count, &cell)) in drops.iter().zip(path.iter().skip(1)).enumerate() {
            if let Some(top) = self.board.top(cell) {
                let is_final_cell = idx == drops.len() - 1;
                let cap_flattens = is_final_cell
                    && hand.len() == drop_count as usize
                    && hand.last().is_some_and(|s| s.kind == StoneKind::Cap)
                    && top.kind == StoneKind::Wall;
                if top.blocks_stack_on_top() && !cap_flattens {
                    return Err(IllegalMove);
                }
            }
            let is_final_cell = idx == drops.len() - 1;
            for drop_idx in 0..drop_count {
                let stone = hand.remove(0);
                let is_last_stone = hand.is_empty();
                if is_final_cell
                    && is_last_stone
                    && drop_idx == drop_count - 1
                    && stone.kind == StoneKind::Cap
                    && self
                        .board
                        .top(cell)
                        .is_some_and(|t| t.kind == StoneKind::Wall)
                {
                    self.board.flatten_wall(cell, player);
                    if !self.board.push_on_stack(cell, stone) {
                        return Err(IllegalMove);
                    }
                } else if !self.board.push_on_stack(cell, stone) {
                    return Err(IllegalMove);
                }
            }
        }

        if !hand.is_empty() {
            return Err(IllegalMove);
        }
        let _ = leave;
        Ok(())
    }
}

pub fn slide_destination(from: Coord, direction: Direction, drops: &[u8]) -> Coord {
    let (dx, dy) = direction.delta();
    let mut coord = from;
    for _ in 0..drops.len() {
        coord = coord.step(dx, dy).expect("slide destination off board");
    }
    coord
}

pub fn slide_drop_cells(from: Coord, direction: Direction, drops: &[u8]) -> Vec<Coord> {
    let (dx, dy) = direction.delta();
    let mut coord = from;
    let mut cells = Vec::with_capacity(drops.len());
    for _ in drops {
        coord = coord.step(dx, dy).expect("slide drop cell off board");
        cells.push(coord);
    }
    cells
}

fn slide_move_touches(m: Move, from: Coord, to: Coord) -> bool {
    let Move::Slide { direction, .. } = m else {
        return false;
    };
    if slide_destination(from, direction, m.slide_drops()) == to {
        return true;
    }
    slide_drop_cells(from, direction, m.slide_drops()).contains(&to)
}

fn slide_to_match_priority(m: Move, from: Coord, to: Coord) -> u8 {
    let Move::Slide { direction, .. } = m else {
        return u8::MAX;
    };
    if slide_destination(from, direction, m.slide_drops()) == to {
        0
    } else {
        1
    }
}

fn pool_index(player: Player) -> usize {
    match player {
        Player::First => 0,
        Player::Second => 1,
    }
}

fn slide_variants(state: &GameState, from: Coord, direction: Direction, pickup: u8) -> Vec<Move> {
    let (dx, dy) = direction.delta();
    let mut moves = Vec::new();
    let max_steps = max_slide_steps(state, from, direction, pickup);
    for steps in 1..=max_steps {
        for drops in drop_partitions(pickup, steps as usize) {
            if slide_would_be_valid(state, from, direction, pickup, &drops) {
                moves.push(Move::slide(from, direction, pickup, &drops));
            }
        }
    }
    let _ = (dx, dy);
    moves
}

fn slide_would_be_valid(
    state: &GameState,
    from: Coord,
    direction: Direction,
    pickup: u8,
    drops: &[u8],
) -> bool {
    let mut clone = state.clone();
    clone.apply_slide(from, direction, pickup, drops).is_ok()
}

fn max_slide_steps(state: &GameState, from: Coord, direction: Direction, pickup: u8) -> u8 {
    let (dx, dy) = direction.delta();
    let mut steps = 0u8;
    let mut coord = from;
    let hand_top = state.board().stack(from).last().copied();
    while steps < CARRY_LIMIT {
        let Some(next) = coord.step(dx, dy) else {
            break;
        };
        if steps > 0
            && let Some(top) = state.board().top(next)
        {
            let cap_can_land = pickup == 1
                && hand_top.is_some_and(|s| s.kind == StoneKind::Cap)
                && top.kind == StoneKind::Wall;
            if top.blocks_stack_on_top() && !cap_can_land {
                break;
            }
        }
        coord = next;
        steps += 1;
    }
    steps.max(1)
}

fn drop_partitions(total: u8, cells: usize) -> Vec<Vec<u8>> {
    let mut out = Vec::new();
    if cells == 0 {
        return out;
    }
    fn rec(remaining: u8, cells_left: usize, prefix: &mut Vec<u8>, out: &mut Vec<Vec<u8>>) {
        if cells_left == 1 {
            if remaining >= 1 {
                prefix.push(remaining);
                out.push(prefix.clone());
                prefix.pop();
            }
            return;
        }
        for drop in 1..=remaining {
            prefix.push(drop);
            rec(remaining - drop, cells_left - 1, prefix, out);
            prefix.pop();
        }
    }
    let mut prefix = Vec::new();
    rec(total, cells, &mut prefix, &mut out);
    out
}

pub fn check_road_win(board: &Board, active_player: Player) -> Option<Player> {
    let opponent = active_player.opponent();
    if road_connects(board, active_player, true) || road_connects(board, active_player, false) {
        return Some(active_player);
    }
    if road_connects(board, opponent, true) || road_connects(board, opponent, false) {
        return Some(opponent);
    }
    None
}

pub fn check_flat_win(board: &Board, reserves: &[Reserve; 2]) -> Option<Player> {
    if !flat_scoring_triggered(board, reserves) {
        return None;
    }
    let first = count_top_flats(board, Player::First);
    let second = count_top_flats(board, Player::Second);
    match first.cmp(&second) {
        std::cmp::Ordering::Greater => Some(Player::First),
        std::cmp::Ordering::Less => Some(Player::Second),
        std::cmp::Ordering::Equal => None,
    }
}

fn flat_scoring_triggered(board: &Board, reserves: &[Reserve; 2]) -> bool {
    board.empty_coords().is_empty() || reserves.iter().all(|r| r.flats == 0)
}

fn count_top_flats(board: &Board, player: Player) -> u32 {
    let mut count = 0u32;
    for y in 0..crate::BOARD_SIZE as u8 {
        for x in 0..crate::BOARD_SIZE as u8 {
            let coord = Coord { x, y };
            if board
                .top(coord)
                .is_some_and(|s| s.owner == player && s.counts_for_road())
            {
                count += 1;
            }
        }
    }
    count
}

fn road_connects(board: &Board, player: Player, horizontal: bool) -> bool {
    let size = crate::BOARD_SIZE as u8;
    let mut visited = [[false; crate::BOARD_SIZE]; crate::BOARD_SIZE];
    let mut queue = Vec::new();

    if horizontal {
        for y in 0..size {
            let coord = Coord { x: 0, y };
            if road_cell(board, coord, player) {
                visited[y as usize][0] = true;
                queue.push(coord);
            }
        }
        while let Some(coord) = queue.pop() {
            if coord.x == size - 1 {
                return true;
            }
            for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                if let Some(next) = coord.step(dx, dy)
                    && !visited[next.y as usize][next.x as usize]
                    && road_cell(board, next, player)
                {
                    visited[next.y as usize][next.x as usize] = true;
                    queue.push(next);
                }
            }
        }
    } else {
        for x in 0..size {
            let coord = Coord { x, y: 0 };
            if road_cell(board, coord, player) {
                visited[0][x as usize] = true;
                queue.push(coord);
            }
        }
        while let Some(coord) = queue.pop() {
            if coord.y == size - 1 {
                return true;
            }
            for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                if let Some(next) = coord.step(dx, dy)
                    && !visited[next.y as usize][next.x as usize]
                    && road_cell(board, next, player)
                {
                    visited[next.y as usize][next.x as usize] = true;
                    queue.push(next);
                }
            }
        }
    }
    false
}

fn road_cell(board: &Board, coord: Coord, player: Player) -> bool {
    board
        .top(coord)
        .is_some_and(|s| s.owner == player && s.counts_for_road())
}

impl Default for GameState {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for Reserve {
    fn default() -> Self {
        Self::new()
    }
}
