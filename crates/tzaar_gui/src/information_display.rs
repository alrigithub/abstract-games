use bevy::prelude::*;
use tzaar::TurnPhase;

use crate::{
    ai::AiPlayerStrength,
    state_update::{GameState, InteractionState},
};

#[derive(Component)]
struct GameStateInformation;

fn setup_information_display(mut commands: Commands) {
    commands.spawn((
        Text::new(""),
        TextFont {
            font_size: 16.0,
            ..default()
        },
        TextColor(abstract_gui_theme::STATUS_TEXT_ON_DARK),
        Node {
            position_type: PositionType::Absolute,
            top: Val::Px(10.),
            left: Val::Px(10.),
            max_width: Val::Px(420.),
            ..default()
        },
        GameStateInformation,
    ));
}

fn status_line(game_state: &GameState, interaction_state: &InteractionState) -> String {
    match interaction_state {
        InteractionState::WaitForAI => "AI is thinking…".into(),
        InteractionState::Winner(p) if *p == crate::PLAYER_HUMAN => "You win!".into(),
        InteractionState::Winner(_) => "AI wins.".into(),
        InteractionState::HumanTurn => match game_state.phase() {
            TurnPhase::WhiteOpening => {
                "Your turn: one adjacent capture (opening).".into()
            }
            TurnPhase::ForcedCapture => {
                "Your turn: forced capture — pick your stack, then an enemy stack.".into()
            }
            TurnPhase::OptionalSecond => {
                "Optional 2nd move: capture, stack, or pass — P, Pass button, right-click, or click an empty hex."
                    .into()
            }
        },
    }
}

fn update_information_display(
    game_state: Res<GameState>,
    interaction_state: Res<InteractionState>,
    ai_player_strength: Res<AiPlayerStrength>,
    mut q_text: Query<&mut Text, With<GameStateInformation>>,
) {
    let Ok(mut text) = q_text.single_mut() else {
        return;
    };

    **text = format!(
        "{}\nAI depth: {}",
        status_line(&game_state, &interaction_state),
        ai_player_strength.0,
    );
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, setup_information_display)
        .add_systems(Update, update_information_display);
}
