use crate::board::Board;
use crate::coord::Coord;
use crate::effects::{LineHighlight, MoveEffects, OffBoardExit, PieceDisplacement};
use crate::piece::{Piece, PieceKind};
use crate::player::Player;
use crate::Move;

pub const KITTENS_PER_PLAYER: u8 = 8;
pub const CATS_PER_PLAYER: u8 = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Pool {
    pub kittens_in_hand: u8,
    pub cats_in_hand: u8,
    pub cats_in_reserve: u8,
}

impl Pool {
    pub fn new() -> Self {
        Self {
            kittens_in_hand: KITTENS_PER_PLAYER,
            cats_in_hand: 0,
            cats_in_reserve: CATS_PER_PLAYER,
        }
    }

    /// Map UI piece choice to what the player can actually place from the pool.
    pub fn normalize_placement_preference(&self, preferred: PieceKind) -> PieceKind {
        match preferred {
            PieceKind::Kitten if self.kittens_in_hand == 0 && self.cats_in_hand > 0 => {
                PieceKind::Cat
            }
            PieceKind::Cat if self.cats_in_hand == 0 && self.kittens_in_hand > 0 => {
                PieceKind::Kitten
            }
            _ => preferred,
        }
    }

    fn take(&mut self, kind: PieceKind) -> bool {
        match kind {
            PieceKind::Kitten if self.kittens_in_hand > 0 => {
                self.kittens_in_hand -= 1;
                true
            }
            PieceKind::Cat if self.cats_in_hand > 0 => {
                self.cats_in_hand -= 1;
                true
            }
            _ => false,
        }
    }

    fn return_piece(&mut self, piece: Piece) {
        match piece.kind {
            PieceKind::Kitten => self.kittens_in_hand += 1,
            PieceKind::Cat => self.cats_in_hand += 1,
        }
    }

    fn graduate_kitten(&mut self) -> bool {
        if self.cats_in_reserve == 0 {
            return false;
        }
        self.cats_in_hand += 1;
        self.cats_in_reserve -= 1;
        true
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IllegalMove;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameState {
    board: Board,
    pools: [Pool; 2],
    to_move: Player,
    winner: Option<Player>,
    last_effects: MoveEffects,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            board: Board::empty(),
            pools: [Pool::new(), Pool::new()],
            to_move: Player::First,
            winner: None,
            last_effects: MoveEffects::default(),
        }
    }

    pub fn last_move_effects(&self) -> &MoveEffects {
        &self.last_effects
    }

    pub fn board(&self) -> &Board {
        &self.board
    }

    pub fn pool(&self, player: Player) -> Pool {
        self.pools[pool_index(player)]
    }

    pub fn to_move(&self) -> Player {
        self.to_move
    }

    pub fn winner(&self) -> Option<Player> {
        self.winner
    }

    #[doc(hidden)]
    pub fn set_piece(&mut self, coord: Coord, piece: Piece) {
        self.board.set(coord, piece);
    }

    #[doc(hidden)]
    pub fn set_to_move(&mut self, player: Player) {
        self.to_move = player;
    }

    #[doc(hidden)]
    pub fn set_pool(&mut self, player: Player, pool: Pool) {
        self.pools[pool_index(player)] = pool;
    }

    /// True when the active player has a full bed and must graduate a kitten or return a cat.
    pub fn requires_alternate_graduation(&self) -> bool {
        let legal = self.legal_moves();
        !legal.is_empty() && legal.iter().all(|m| !matches!(m, Move::Place { .. }))
    }

    /// Map a board click (and placement piece preference) to a legal move, if any.
    pub fn move_for_interaction(
        &self,
        player: Player,
        coord: Coord,
        preferred_placement: PieceKind,
    ) -> Option<Move> {
        if self.to_move() != player || self.winner().is_some() {
            return None;
        }
        let legal = self.legal_moves();
        if legal.is_empty() {
            return None;
        }

        if self.requires_alternate_graduation() {
            let piece = self.board.get(coord)?;
            if piece.player != player {
                return None;
            }
            let graduate = Move::GraduateSingleKitten { coord };
            let return_cat = Move::ReturnCatToPool { coord };
            return match piece.kind {
                PieceKind::Kitten if legal.contains(&graduate) => Some(graduate),
                PieceKind::Cat if legal.contains(&return_cat) => Some(return_cat),
                _ => None,
            };
        }

        if !self.board.is_empty(coord) {
            return None;
        }

        let preferred_placement = self.pool(player).normalize_placement_preference(preferred_placement);

        let preferred = Move::Place {
            coord,
            piece: preferred_placement,
        };
        if legal.contains(&preferred) {
            return Some(preferred);
        }
        let fallback = Move::Place {
            coord,
            piece: match preferred_placement {
                PieceKind::Kitten => PieceKind::Cat,
                PieceKind::Cat => PieceKind::Kitten,
            },
        };
        legal.contains(&fallback).then_some(fallback)
    }

    pub fn legal_moves(&self) -> Vec<Move> {
        if self.winner.is_some() {
            return Vec::new();
        }
        let player = self.to_move;
        let pool = self.pool(player);
        let on_board = self.board.count_pieces(player);

        if on_board >= 8 {
            return alternate_graduation_moves(self, player, pool);
        }

        let mut moves = Vec::new();
        for coord in self.board.empty_coords() {
            if pool.kittens_in_hand > 0 {
                moves.push(Move::Place {
                    coord,
                    piece: PieceKind::Kitten,
                });
            }
            if pool.cats_in_hand > 0 {
                moves.push(Move::Place {
                    coord,
                    piece: PieceKind::Cat,
                });
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

        self.last_effects = MoveEffects::default();

        match player_move {
            Move::Place { coord, piece: kind } => self.apply_place(coord, kind),
            Move::GraduateSingleKitten { coord } => self.apply_graduate_single_kitten(coord),
            Move::ReturnCatToPool { coord } => self.apply_return_cat_to_pool(coord),
        }
    }

    fn apply_place(&mut self, coord: Coord, kind: PieceKind) -> Result<(), IllegalMove> {
        if Coord::try_new(coord.x, coord.y).is_none() || !self.board.is_empty(coord) {
            return Err(IllegalMove);
        }

        let player = self.to_move;
        if !self.pools[pool_index(player)].take(kind) {
            return Err(IllegalMove);
        }
        if self.board.count_pieces(player) >= 8 {
            self.pools[pool_index(player)].return_piece(Piece { player, kind });
            return Err(IllegalMove);
        }

        let placed = Piece { player, kind };
        self.board.set(coord, placed);
        resolve_boops(
            &mut self.board,
            coord,
            placed,
            &mut self.pools,
            &mut self.last_effects,
        );
        resolve_graduation(self, player);
        finish_turn_after_placement(self, player);
        Ok(())
    }

    fn apply_graduate_single_kitten(&mut self, coord: Coord) -> Result<(), IllegalMove> {
        let player = self.to_move;
        if self.board.count_pieces(player) < 8 {
            return Err(IllegalMove);
        }
        let Some(piece) = self.board.get(coord) else {
            return Err(IllegalMove);
        };
        if piece.player != player || piece.kind != PieceKind::Kitten {
            return Err(IllegalMove);
        }
        if !self.pools[pool_index(player)].graduate_kitten() {
            return Err(IllegalMove);
        }
        self.board.clear(coord);
        finish_turn_after_alternate(self, player);
        Ok(())
    }

    fn apply_return_cat_to_pool(&mut self, coord: Coord) -> Result<(), IllegalMove> {
        let player = self.to_move;
        if self.board.count_pieces(player) < 8 {
            return Err(IllegalMove);
        }
        let Some(piece) = self.board.get(coord) else {
            return Err(IllegalMove);
        };
        if piece.player != player || piece.kind != PieceKind::Cat {
            return Err(IllegalMove);
        }
        self.board.clear(coord);
        self.pools[pool_index(player)].cats_in_hand += 1;
        finish_turn_after_alternate(self, player);
        Ok(())
    }
}

fn alternate_graduation_moves(state: &GameState, player: Player, pool: Pool) -> Vec<Move> {
    let mut moves = Vec::new();
    for y in 0..crate::BOARD_SIZE as u8 {
        for x in 0..crate::BOARD_SIZE as u8 {
            let coord = Coord { x, y };
            let Some(piece) = state.board.get(coord) else {
                continue;
            };
            if piece.player != player {
                continue;
            }
            match piece.kind {
                PieceKind::Kitten if pool.cats_in_reserve > 0 => {
                    moves.push(Move::GraduateSingleKitten { coord });
                }
                PieceKind::Cat => {
                    moves.push(Move::ReturnCatToPool { coord });
                }
                _ => {}
            }
        }
    }
    moves
}

fn finish_turn_after_placement(state: &mut GameState, player: Player) {
    if state.winner.is_none() && check_win(&state.board, player) {
        if let Some(line) = find_winning_cat_line(&state.board, player) {
            state.last_effects.line_highlight = Some(LineHighlight::Win(line));
        } else if state.board.count_cats(player) >= 8 {
            state.last_effects.line_highlight = Some(LineHighlight::EightCatsOnBed);
        }
        state.winner = Some(player);
    }
    if state.winner.is_none() {
        state.to_move = player.opponent();
    }
}

fn finish_turn_after_alternate(state: &mut GameState, player: Player) {
    if state.winner.is_none() && check_win(&state.board, player) {
        if let Some(line) = find_winning_cat_line(&state.board, player) {
            state.last_effects.line_highlight = Some(LineHighlight::Win(line));
        } else if state.board.count_cats(player) >= 8 {
            state.last_effects.line_highlight = Some(LineHighlight::EightCatsOnBed);
        }
        state.winner = Some(player);
    }
    if state.winner.is_none() {
        state.to_move = player.opponent();
    }
}

fn pool_index(player: Player) -> usize {
    match player {
        Player::First => 0,
        Player::Second => 1,
    }
}

const DIRECTIONS: [(i8, i8); 8] = [
    (0, -1),
    (1, -1),
    (1, 0),
    (1, 1),
    (0, 1),
    (-1, 1),
    (-1, 0),
    (-1, -1),
];

#[derive(Debug, Clone, Copy)]
enum PendingBoop {
    Displace {
        from: Coord,
        to: Coord,
        piece: Piece,
    },
    OffBoard {
        from: Coord,
        piece: Piece,
        push: (i8, i8),
    },
}

fn resolve_boops(
    board: &mut Board,
    placed_at: Coord,
    placed: Piece,
    pools: &mut [Pool; 2],
    effects: &mut MoveEffects,
) {
    let snapshot = board.clone();
    let mut pending = Vec::new();
    let mut reserved_destinations = std::collections::HashSet::new();

    for (dx, dy) in DIRECTIONS {
        let Some(adj) = placed_at.step(dx, dy) else {
            continue;
        };
        let Some(piece) = snapshot.get(adj) else {
            continue;
        };
        if placed.kind == PieceKind::Kitten && piece.kind == PieceKind::Cat {
            continue;
        }

        let push_dir = (dx, dy);
        if is_braced(&snapshot, placed_at, adj, push_dir) {
            continue;
        }

        match adj.step(push_dir.0, push_dir.1) {
            None => {
                pending.push(PendingBoop::OffBoard {
                    from: adj,
                    piece,
                    push: push_dir,
                });
            }
            Some(dest) => {
                if !snapshot.is_empty(dest) || reserved_destinations.contains(&dest) {
                    continue;
                }
                reserved_destinations.insert(dest);
                pending.push(PendingBoop::Displace {
                    from: adj,
                    to: dest,
                    piece,
                });
            }
        }
    }

    for boop in pending {
        match boop {
            PendingBoop::OffBoard { from, piece, push } => {
                board.clear(from);
                pools[pool_index(piece.player)].return_piece(piece);
                effects.off_board.push(OffBoardExit {
                    from,
                    piece,
                    push,
                });
            }
            PendingBoop::Displace { from, to, piece } => {
                board.clear(from);
                debug_assert!(board.get(to).is_none(), "boop onto occupied cell");
                board.set(to, piece);
                effects.displacements.push(PieceDisplacement { from, to, piece });
            }
        }
    }
}

/// Pieces in a contiguous straight line of two or more brace against pushes along that line.
fn is_braced(board: &Board, placed_at: Coord, adj: Coord, push_dir: (i8, i8)) -> bool {
    contiguous_line_count(board, placed_at, adj, push_dir) >= 2
}

fn contiguous_line_count(
    board: &Board,
    exclude: Coord,
    seed: Coord,
    direction: (i8, i8),
) -> u32 {
    if board.get(seed).is_none() {
        return 0;
    }

    let (dx, dy) = direction;
    let mut count = if seed == exclude { 0 } else { 1 };

    let mut c = seed;
    while let Some(next) = c.step(dx, dy) {
        if next == exclude {
            c = next;
            continue;
        }
        if board.get(next).is_some() {
            count += 1;
            c = next;
        } else {
            break;
        }
    }

    c = seed;
    while let Some(next) = c.step(-dx, -dy) {
        if next == exclude {
            c = next;
            continue;
        }
        if board.get(next).is_some() {
            count += 1;
            c = next;
        } else {
            break;
        }
    }

    count
}

fn resolve_graduation(state: &mut GameState, player: Player) {
    // First qualifying line of three (scan order); three cats in a row is a win, not graduation.
    let Some(line) = find_graduation_triple(&state.board, player) else {
        return;
    };
    state.last_effects.line_highlight = Some(LineHighlight::Graduation(line));
    state.last_effects.graduated_cells = Some(line);
    let pool = &mut state.pools[pool_index(player)];
    for coord in line {
        let Some(piece) = state.board.get(coord) else {
            continue;
        };
        state.board.clear(coord);
        match piece.kind {
            PieceKind::Kitten => {
                let _ = pool.graduate_kitten();
            }
            PieceKind::Cat => {
                pool.cats_in_hand += 1;
            }
        }
    }
}

fn find_graduation_triple(board: &Board, player: Player) -> Option<[Coord; 3]> {
    let line_dirs = [(1, 0), (0, 1), (1, 1), (1, -1)];

    for y in 0..crate::BOARD_SIZE as u8 {
        for x in 0..crate::BOARD_SIZE as u8 {
            let start = Coord { x, y };
            for (dx, dy) in line_dirs {
                let Some(a) = start.step(dx, dy) else {
                    continue;
                };
                let Some(b) = start.step(dx * 2, dy * 2) else {
                    continue;
                };
                let cells = [start, a, b];
                if !cells.iter().all(|coord| {
                    board
                        .get(*coord)
                        .is_some_and(|p| p.player == player)
                }) {
                    continue;
                }
                let all_cats = cells.iter().all(|coord| {
                    board
                        .get(*coord)
                        .is_some_and(|p| p.kind == PieceKind::Cat)
                });
                if all_cats {
                    continue;
                }
                return Some(cells);
            }
        }
    }
    None
}

fn find_winning_cat_line(board: &Board, player: Player) -> Option<[Coord; 3]> {
    let line_dirs = [(1, 0), (0, 1), (1, 1), (1, -1)];

    for y in 0..crate::BOARD_SIZE as u8 {
        for x in 0..crate::BOARD_SIZE as u8 {
            let start = Coord { x, y };
            for (dx, dy) in line_dirs {
                let Some(a) = start.step(dx, dy) else {
                    continue;
                };
                let Some(b) = start.step(dx * 2, dy * 2) else {
                    continue;
                };
                let line = [start, a, b];
                if line.iter().all(|coord| {
                    board
                        .get(*coord)
                        .is_some_and(|p| p.player == player && p.kind == PieceKind::Cat)
                }) {
                    return Some(line);
                }
            }
        }
    }
    None
}

fn check_win(board: &Board, player: Player) -> bool {
    find_winning_cat_line(board, player).is_some() || board.count_cats(player) >= 8
}

impl Default for GameState {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for Pool {
    fn default() -> Self {
        Self::new()
    }
}
