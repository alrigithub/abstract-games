use gomoku::{Board, Coord, GameState, Player, BOARD_SIZE};
use minimax::Evaluation;

use crate::evaluator::Heuristic;
use crate::game::player_stones;

#[derive(Debug, Clone, Copy)]
pub struct SimpleHeuristic {
    pub f_material: Evaluation,
    pub f_open_two: Evaluation,
    pub f_open_three: Evaluation,
    pub f_open_four: Evaluation,
    pub f_center: Evaluation,
}

impl Default for SimpleHeuristic {
    fn default() -> Self {
        Self {
            f_material: 10,
            f_open_two: 50,
            f_open_three: 500,
            f_open_four: 5_000,
            f_center: 3,
        }
    }
}

impl Heuristic for SimpleHeuristic {
    fn evaluate_for_black(&self, state: &GameState) -> Evaluation {
        let board = &state.board;
        let material = player_stones(board, Player::Black) as Evaluation
            - player_stones(board, Player::White) as Evaluation;

        let black_threats = threat_counts(board, Player::Black);
        let white_threats = threat_counts(board, Player::White);

        let threat_score = self.f_open_two * (black_threats.open_two - white_threats.open_two)
            + self.f_open_three * (black_threats.open_three - white_threats.open_three)
            + self.f_open_four * (black_threats.open_four - white_threats.open_four);

        let center = center_score(board, Player::Black) - center_score(board, Player::White);

        self.f_material * material + threat_score + self.f_center * center
    }

    fn identifier(&self) -> String {
        "simple".into()
    }
}

#[derive(Default, Clone, Copy)]
struct ThreatCounts {
    open_two: Evaluation,
    open_three: Evaluation,
    open_four: Evaluation,
}

fn threat_counts(board: &Board, player: Player) -> ThreatCounts {
    let mut counts = ThreatCounts::default();
    let directions = [(1, 0), (0, 1), (1, 1), (1, -1)];

    for y in 0..BOARD_SIZE as u8 {
        for x in 0..BOARD_SIZE as u8 {
            let start = Coord { x, y };
            if board.get(start) != Some(player) {
                continue;
            }
            for (dx, dy) in directions {
                if is_line_start(board, start, player, dx, dy) {
                    classify_line(board, start, player, dx, dy, &mut counts);
                }
            }
        }
    }
    counts
}

fn is_line_start(board: &Board, start: Coord, player: Player, dx: i8, dy: i8) -> bool {
    match step(start, -dx, -dy) {
        Some(prev) => board.get(prev) != Some(player),
        None => true,
    }
}

fn step(coord: Coord, dx: i8, dy: i8) -> Option<Coord> {
    let x = coord.x as i16 + dx as i16;
    let y = coord.y as i16 + dy as i16;
    if x >= 0 && y >= 0 && (x as usize) < BOARD_SIZE && (y as usize) < BOARD_SIZE {
        Some(Coord {
            x: x as u8,
            y: y as u8,
        })
    } else {
        None
    }
}

fn classify_line(
    board: &Board,
    start: Coord,
    player: Player,
    dx: i8,
    dy: i8,
    counts: &mut ThreatCounts,
) {
    let mut length = 0u8;
    let mut x = start.x as i16;
    let mut y = start.y as i16;

    while x >= 0
        && y >= 0
        && (x as usize) < BOARD_SIZE
        && (y as usize) < BOARD_SIZE
        && board.get(Coord {
            x: x as u8,
            y: y as u8,
        }) == Some(player)
    {
        length += 1;
        x += dx as i16;
        y += dy as i16;
    }

    let before_open = step(start, -dx, -dy).is_some_and(|c| board.get(c).is_none());
    let after_open = if x >= 0
        && y >= 0
        && (x as usize) < BOARD_SIZE
        && (y as usize) < BOARD_SIZE
    {
        board
            .get(Coord {
                x: x as u8,
                y: y as u8,
            })
            .is_none()
    } else {
        false
    };
    let open_ends = before_open as u8 + after_open as u8;

    match (length, open_ends) {
        (2, 2) => counts.open_two += 1,
        (3, 2) => counts.open_three += 1,
        (4, 2) => counts.open_four += 1,
        (3, 1) => counts.open_three += 1,
        (4, 1) => counts.open_four += 1,
        _ => {}
    }
}

fn center_score(board: &Board, player: Player) -> Evaluation {
    let center = BOARD_SIZE as i16 / 2;
    (0..BOARD_SIZE as u8)
        .flat_map(|y| (0..BOARD_SIZE as u8).map(move |x| Coord { x, y }))
        .filter(|coord| board.get(*coord) == Some(player))
        .map(|coord| {
            center - ((coord.x as i16 - center).abs() + (coord.y as i16 - center).abs())
        })
        .sum()
}
