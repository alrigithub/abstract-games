use bevy::prelude::*;

use boop::Player;

use crate::{
    ai::AiPlayerStrength,
    interaction::CursorCoord,
    state_update::{GameState, HumanPieceChoice, InteractionState},
    PLAYER_HUMAN,
};

#[derive(Component)]
struct GameStateInformation;

fn setup_information_display(mut commands: Commands) {
    commands.spawn((
        Text::new(""),
        TextFont {
            font_size: 17.0,
            ..default()
        },
        TextColor(Color::hsl(0.0, 0.0, 0.88)),
        Node {
            position_type: PositionType::Absolute,
            top: Val::Px(10.),
            left: Val::Px(10.),
            ..default()
        },
        GameStateInformation,
    ));
}

fn update_information_display(
    game_state: Res<GameState>,
    mut q_text: Query<&mut Text, With<GameStateInformation>>,
    cursor_coord: Res<CursorCoord>,
    interaction_state: Res<InteractionState>,
    ai_player_strength: Res<AiPlayerStrength>,
    selected_piece: Res<HumanPieceChoice>,
) {
    let Ok(mut text) = q_text.single_mut() else {
        return;
    };

    let pool = game_state.pool(PLAYER_HUMAN);
    let mode = match *interaction_state {
        InteractionState::HumanPlace => format!(
            "Place a {} (bottom buttons or C key)",
            match selected_piece.0 {
                boop::PieceKind::Kitten => "kitten",
                boop::PieceKind::Cat => "cat",
            }
        ),
        InteractionState::HumanFullBed => {
            "Bed full: click your kitten to graduate, or your cat to return it to pool".into()
        }
        InteractionState::HumanNoMoves => "No legal moves (engine deadlock - please reset)".into(),
        InteractionState::WaitForAI => "AI is thinking...".into(),
        InteractionState::Winner(Player::First) => "You win!".into(),
        InteractionState::Winner(Player::Second) => "AI wins.".into(),
    };

    **text = format!(
        "Pool - kittens: {k}, cats in hand: {c}, cats in reserve: {r}\n{mode}\nAI depth: {strength}{coord}",
        k = pool.kittens_in_hand,
        c = pool.cats_in_hand,
        r = pool.cats_in_reserve,
        strength = ai_player_strength.0,
        coord = cursor_coord
            .0
            .map(|c| format!("\nCursor: ({}, {})", c.x, c.y))
            .unwrap_or_default(),
    );
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, setup_information_display)
        .add_systems(Update, update_information_display);
}
