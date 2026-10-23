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

/// What the player to move has to do next.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TurnMode {
    /// Place a kitten or cat from the pool onto an empty cell.
    Place,
    /// All eight pieces are on the bed: graduate one kitten or return one cat to the pool.
    AlternateGraduation,
    /// The last placement completed several graduating lines; the mover picks one.
    /// Lines are in board scan order (top-left first).
    ChooseGraduation(Vec<[Coord; 3]>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameState {
    board: Board,
    pools: [Pool; 2],
    to_move: Player,
    winner: Option<Player>,
    last_effects: MoveEffects,
    /// Candidate lines awaiting the mover's choice (empty when no choice is pending).
    pending_graduation: Vec<[Coord; 3]>,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            board: Board::empty(),
            pools: [Pool::new(), Pool::new()],
            to_move: Player::First,
            winner: None,
            last_effects: MoveEffects::default(),
            pending_graduation: Vec::new(),
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

    /// What the player to move must do next (meaningless once there is a winner).
    pub fn turn_mode(&self) -> TurnMode {
        if !self.pending_graduation.is_empty() {
            TurnMode::ChooseGraduation(self.pending_graduation.clone())
        } else if self.board.count_pieces(self.to_move) >= 8 {
            TurnMode::AlternateGraduation
        } else {
            TurnMode::Place
        }
    }

    /// Lines the mover may graduate right now (empty unless a choice is pending).
    pub fn pending_graduation_lines(&self) -> &[[Coord; 3]] {
        &self.pending_graduation
    }

    /// True when the active player has a full bed and must graduate a kitten or return a cat.
    pub fn requires_alternate_graduation(&self) -> bool {
        self.winner.is_none() && self.turn_mode() == TurnMode::AlternateGraduation
    }

    /// While a graduation choice is pending: the unique candidate line containing `coord`.
    /// Cells shared by several candidate lines are ambiguous and yield `None`.
    pub fn graduation_choice_at(&self, coord: Coord) -> Option<[Coord; 3]> {
        let mut containing = self
            .pending_graduation
            .iter()
            .filter(|line| line.contains(&coord));
        let line = containing.next()?;
        containing.next().is_none().then_some(*line)
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

        if !self.pending_graduation.is_empty() {
            if let Some(line) = self.graduation_choice_at(coord) {
                let graduate = Move::Graduate { line };
                return legal.contains(&graduate).then_some(graduate);
            }
            // Shared or off-line cell: fall through so a full bed can still
            // activate alternate graduation (rulebook: choose which to activate).
        }

        if self.board.count_pieces(player) >= 8 {
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

        let preferred_placement = self
            .pool(player)
            .normalize_placement_preference(preferred_placement);

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
        if !self.pending_graduation.is_empty() {
            let mut moves: Vec<Move> = self
                .pending_graduation
                .iter()
                .map(|line| Move::Graduate { line: *line })
                .collect();
            if self.board.count_pieces(self.to_move) >= 8 {
                moves.extend(alternate_graduation_moves(
                    self,
                    self.to_move,
                    self.pool(self.to_move),
                ));
            }
            return moves;
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
            Move::Graduate { line } => self.apply_graduate(line),
            Move::GraduateSingleKitten { coord } => self.apply_graduate_single_kitten(coord),
            Move::ReturnCatToPool { coord } => self.apply_return_cat_to_pool(coord),
        }
    }

    /// Place → boop → graduate (or choose) → end-of-turn win check.
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

        let candidates = graduation_candidates(&self.board, player);
        let bed_full = full_bed_without_eight_cats(&self.board, player);
        match candidates.as_slice() {
            [] => {}
            [line] if !bed_full => {
                graduate_line(self, player, *line);
                finish_turn(self, player);
                return Ok(());
            }
            _ => {
                // Several lines, or one line plus a full bed: the mover keeps the
                // turn and chooses which graduation to activate.
                self.pending_graduation = candidates;
                return Ok(());
            }
        }

        if bed_full {
            return Ok(());
        }

        finish_turn(self, player);
        Ok(())
    }

    fn apply_graduate(&mut self, line: [Coord; 3]) -> Result<(), IllegalMove> {
        if !self.pending_graduation.contains(&line) {
            return Err(IllegalMove);
        }
        let player = self.to_move;
        self.pending_graduation.clear();
        graduate_line(self, player, line);
        finish_turn(self, player);
        Ok(())
    }

    fn apply_graduate_single_kitten(&mut self, coord: Coord) -> Result<(), IllegalMove> {
        let player = self.to_move;
        self.pending_graduation.clear();
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
        finish_turn(self, player);
        Ok(())
    }

    fn apply_return_cat_to_pool(&mut self, coord: Coord) -> Result<(), IllegalMove> {
        let player = self.to_move;
        self.pending_graduation.clear();
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
        finish_turn(self, player);
        Ok(())
    }
}

fn full_bed_without_eight_cats(board: &Board, player: Player) -> bool {
    board.count_pieces(player) >= 8 && board.count_cats(player) < CATS_PER_PLAYER as u32
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

/// End-of-turn win check (three cats in a row, or all eight cats on the bed), then pass the turn.
/// Called after graduation has been resolved — a mixed line that shared a cat with a
/// three-cat line is allowed to destroy that win.
fn finish_turn(state: &mut GameState, player: Player) {
    if state.winner.is_none() {
        if let Some(line) = find_winning_cat_line(&state.board, player) {
            state.last_effects.line_highlight = Some(LineHighlight::Win(line));
            state.winner = Some(player);
        } else if state.board.count_cats(player) >= CATS_PER_PLAYER as u32 {
            state.last_effects.line_highlight = Some(LineHighlight::EightCatsOnBed);
            state.winner = Some(player);
        }
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
        match adj.step(push_dir.0, push_dir.1) {
            None => {
                pending.push(PendingBoop::OffBoard {
                    from: adj,
                    piece,
                    push: push_dir,
                });
            }
            Some(dest) => {
                // Brace rule: a piece with another piece directly behind it (in the push
                // direction) stays put. Pieces elsewhere on the line do not brace it.
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
                effects.off_board.push(OffBoardExit { from, piece, push });
            }
            PendingBoop::Displace { from, to, piece } => {
                board.clear(from);
                debug_assert!(board.get(to).is_none(), "boop onto occupied cell");
                board.set(to, piece);
                effects
                    .displacements
                    .push(PieceDisplacement { from, to, piece });
            }
        }
    }
}

/// Remove the three pieces of `line`: kittens graduate (reserve cat → pool), cats return to pool.
fn graduate_line(state: &mut GameState, player: Player, line: [Coord; 3]) {
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

/// Every contiguous straight triple of `player`'s pieces, in board scan order.
fn triples_of(board: &Board, player: Player) -> impl Iterator<Item = [Coord; 3]> + '_ {
    const LINE_DIRS: [(i8, i8); 4] = [(1, 0), (0, 1), (1, 1), (1, -1)];

    (0..crate::BOARD_SIZE as u8)
        .flat_map(|y| (0..crate::BOARD_SIZE as u8).map(move |x| Coord { x, y }))
        .flat_map(|start| LINE_DIRS.into_iter().map(move |dir| (start, dir)))
        .filter_map(move |(start, (dx, dy))| {
            let a = start.step(dx, dy)?;
            let b = start.step(dx * 2, dy * 2)?;
            let line = [start, a, b];
            line.iter()
                .all(|coord| board.get(*coord).is_some_and(|p| p.player == player))
                .then_some(line)
        })
}

/// Lines of three that graduate (at least one kitten). Three cats in a row is a win instead.
fn graduation_candidates(board: &Board, player: Player) -> Vec<[Coord; 3]> {
    triples_of(board, player)
        .filter(|line| {
            line.iter().any(|coord| {
                board
                    .get(*coord)
                    .is_some_and(|p| p.kind == PieceKind::Kitten)
            })
        })
        .collect()
}

fn find_winning_cat_line(board: &Board, player: Player) -> Option<[Coord; 3]> {
    triples_of(board, player).find(|line| {
        line.iter()
            .all(|coord| board.get(*coord).is_some_and(|p| p.kind == PieceKind::Cat))
    })
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
