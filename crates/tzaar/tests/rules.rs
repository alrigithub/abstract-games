use tzaar::{Board, Coord, GameState, Move, Piece, PieceKind, Player, Stack, TurnPhase};

#[test]
fn fixed_start_has_sixty_stacks() {
    let g = GameState::new();
    let occupied = tzaar::all_playable_coords()
        .into_iter()
        .filter(|c| g.board().stack(*c).is_some())
        .count();
    assert_eq!(occupied, 60);
}

#[test]
fn opening_is_white_adjacent_capture_only() {
    let g = GameState::new();
    assert_eq!(g.phase(), TurnPhase::WhiteOpening);
    assert_eq!(g.to_move(), Player::First);
    let moves = g.legal_moves();
    assert!(!moves.is_empty());
    for m in moves {
        let Move::Action { from, to } = m else {
            panic!("opening allows only captures");
        };
        assert!(tzaar::DIRECTIONS
            .iter()
            .any(|dir| tzaar::step(from, *dir) == to));
    }
}

#[test]
fn white_opening_then_black_forced_capture() {
    let mut g = GameState::new();
    let opening = g.legal_moves()[0];
    g.apply(opening).unwrap();
    assert_eq!(g.to_move(), Player::Second);
    assert_eq!(g.phase(), TurnPhase::ForcedCapture);
}

#[test]
fn forced_capture_then_optional_second() {
    let mut g = GameState::new();
    g.apply(g.legal_moves()[0]).unwrap();
    let capture = g.legal_moves()[0];
    g.apply(capture).unwrap();
    assert_eq!(g.to_move(), Player::Second);
    assert_eq!(g.phase(), TurnPhase::OptionalSecond);
    assert!(g.legal_moves().iter().any(|m| *m == Move::PassSecond));
}

#[test]
fn pass_second_ends_turn() {
    let mut g = GameState::new();
    g.apply(g.legal_moves()[0]).unwrap();
    g.apply(g.legal_moves()[0]).unwrap();
    g.apply(Move::PassSecond).unwrap();
    assert_eq!(g.to_move(), Player::First);
    assert_eq!(g.phase(), TurnPhase::ForcedCapture);
}

#[test]
fn capture_removes_defender_stack() {
    let mut g = GameState::new();
    g.apply(g.legal_moves()[0]).unwrap();
    let before = count_stacks(&g);
    let m = g.legal_moves()[0];
    let Move::Action { to, .. } = m else {
        panic!();
    };
    g.apply(m).unwrap();
    let after = count_stacks(&g);
    assert_eq!(after, before - 1);
    assert!(g.board().stack(to).is_some());
}

#[test]
fn line_capture_over_empty_hexes() {
    let mut board = Board::default();
    let white_from = Coord::new(0, 4);
    let black = Coord::new(3, 4);
    board.set_stack(
        white_from,
        Stack::singleton(Piece {
            player: Player::First,
            kind: PieceKind::Tzaar,
        }),
    );
    board.set_stack(
        black,
        Stack::singleton(Piece {
            player: Player::Second,
            kind: PieceKind::Tott,
        }),
    );

    let captures = board.capture_targets(white_from, Player::First);
    assert!(captures.contains(&black));

    let mut g = GameState::new();
    g.set_board(board);
    g.set_to_move(Player::First);
    g.set_phase(TurnPhase::ForcedCapture);
    g.apply(Move::Action {
        from: white_from,
        to: black,
    })
    .unwrap();
    assert!(g.board().stack(black).is_some());
    assert!(g.board().stack(white_from).is_none());
}

#[test]
fn stacking_increases_height() {
    let mut board = Board::default();
    let a = Coord::new(0, 0);
    let b = Coord::new(1, 0);
    board.set_stack(
        a,
        Stack::singleton(Piece {
            player: Player::First,
            kind: PieceKind::Tott,
        }),
    );
    board.set_stack(
        b,
        Stack::singleton(Piece {
            player: Player::First,
            kind: PieceKind::Tzaar,
        }),
    );

    let mut g = GameState::new();
    g.set_board(board);
    g.set_to_move(Player::First);
    g.set_phase(TurnPhase::OptionalSecond);
    g.apply(Move::Action { from: a, to: b }).unwrap();
    assert_eq!(g.board().stack(b).unwrap().height(), 2);
    assert_eq!(
        g.board().stack(b).unwrap().top().kind,
        PieceKind::Tott
    );
}

fn count_stacks(g: &GameState) -> usize {
    tzaar::all_playable_coords()
        .into_iter()
        .filter(|c| g.board().stack(*c).is_some())
        .count()
}
