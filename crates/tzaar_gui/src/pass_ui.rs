use bevy::ecs::message::MessageWriter;
use bevy::prelude::*;
use tzaar::Move;

use crate::{
    PLAYER_HUMAN,
    state_update::{GameState, InteractionState, PlayerMoveEvent, StateUpdateSet},
};

#[derive(Component)]
struct PassButtonRoot;

pub fn human_may_pass(game_state: &GameState, interaction_state: &InteractionState) -> bool {
    matches!(*interaction_state, InteractionState::HumanTurn)
        && game_state.phase() == tzaar::TurnPhase::OptionalSecond
        && game_state.legal_moves().contains(&Move::PassSecond)
}

pub fn submit_pass(player_move_events: &mut MessageWriter<PlayerMoveEvent>) {
    player_move_events.write(PlayerMoveEvent(PLAYER_HUMAN, Move::PassSecond));
}

fn setup_pass_button(mut commands: Commands) {
    commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                bottom: Val::Px(96.),
                right: Val::Px(10.),
                padding: UiRect::all(Val::Px(10.)),
                border: UiRect::all(Val::Px(1.)),
                ..default()
            },
            BackgroundColor(Color::srgba(0.12, 0.12, 0.16, 0.95)),
            BorderColor::all(Color::srgb(0.55, 0.52, 0.45)),
            Visibility::Hidden,
            PassButtonRoot,
            Button,
            Interaction::None,
        ))
        .with_child((
            Text::new("Pass 2nd move"),
            TextFont {
                font_size: 15.0,
                ..default()
            },
            TextColor(Color::srgb(0.95, 0.92, 0.85)),
        ));
}

fn update_pass_button_visibility(
    game_state: Res<GameState>,
    interaction_state: Res<InteractionState>,
    mut q: Query<&mut Visibility, With<PassButtonRoot>>,
) {
    let Ok(mut visibility) = q.single_mut() else {
        return;
    };
    *visibility = if human_may_pass(&game_state, &interaction_state) {
        Visibility::Visible
    } else {
        Visibility::Hidden
    };
}

fn handle_pass_button_click(
    game_state: Res<GameState>,
    interaction_state: Res<InteractionState>,
    q: Query<&Interaction, (With<PassButtonRoot>, Changed<Interaction>)>,
    mut player_move_events: MessageWriter<PlayerMoveEvent>,
) {
    if !human_may_pass(&game_state, &interaction_state) {
        return;
    }
    for interaction in q.iter() {
        if *interaction == Interaction::Pressed {
            submit_pass(&mut player_move_events);
        }
    }
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, setup_pass_button).add_systems(
        Update,
        (
            update_pass_button_visibility,
            handle_pass_button_click.before(StateUpdateSet),
        ),
    );
}
