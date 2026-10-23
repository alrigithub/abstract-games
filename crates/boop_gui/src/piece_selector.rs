use bevy::prelude::*;
use boop::PieceKind;

use crate::{
    PLAYER_HUMAN,
    state_update::{GameState, HumanPieceChoice, InteractionState},
};

#[derive(Component)]
struct PieceSelectorRoot;

#[derive(Component, Clone, Copy)]
struct PieceChoiceButton {
    kind: PieceKind,
}

#[derive(Component)]
struct PieceChoiceLabel;

fn setup_piece_selector(mut commands: Commands) {
    commands
        .spawn((
            PieceSelectorRoot,
            Node {
                position_type: PositionType::Absolute,
                bottom: Val::Px(12.0),
                left: Val::Percent(50.0),
                margin: UiRect {
                    left: Val::Px(-150.0),
                    ..default()
                },
                width: Val::Px(300.0),
                flex_direction: FlexDirection::Column,
                row_gap: Val::Px(6.0),
                align_items: AlignItems::Center,
                ..default()
            },
        ))
        .with_children(|parent| {
            parent.spawn((
                Text::new("Place piece (C key toggles)"),
                TextFont {
                    font_size: 13.0,
                    ..default()
                },
                TextColor(Color::srgb(0.72, 0.74, 0.78)),
            ));
            parent
                .spawn(Node {
                    flex_direction: FlexDirection::Row,
                    column_gap: Val::Px(10.0),
                    ..default()
                })
                .with_children(|row| {
                    for (label, kind) in [("Kitten (small)", PieceKind::Kitten), ("Cat (big)", PieceKind::Cat)]
                    {
                        row.spawn((
                            Button,
                            PieceChoiceButton { kind },
                            Node {
                                padding: UiRect::axes(Val::Px(14.0), Val::Px(8.0)),
                                border: UiRect::all(Val::Px(2.0)),
                                ..default()
                            },
                            BorderColor::all(Color::srgb(0.35, 0.38, 0.42)),
                            BackgroundColor(Color::srgb(0.18, 0.2, 0.24)),
                        ))
                        .with_child((
                            Text::new(label),
                            TextFont {
                                font_size: 15.0,
                                ..default()
                            },
                            TextColor(Color::srgb(0.9, 0.9, 0.92)),
                            PieceChoiceLabel,
                        ));
                    }
                });
        });
}

#[allow(clippy::type_complexity)]
fn sync_piece_selector(
    game_state: Res<GameState>,
    interaction_state: Res<InteractionState>,
    selected: Res<HumanPieceChoice>,
    mut buttons: Query<
        (
            &PieceChoiceButton,
            &mut BackgroundColor,
            &mut BorderColor,
            &Children,
        ),
        With<Button>,
    >,
    mut labels: Query<&mut TextColor, With<PieceChoiceLabel>>,
) {
    let human_placing = matches!(
        *interaction_state,
        InteractionState::HumanPlace | InteractionState::HumanFullBed
    );
    let can_place_cat = game_state.pool(PLAYER_HUMAN).cats_in_hand > 0;

    for (button, mut bg, mut border, children) in buttons.iter_mut() {
        let enabled = human_placing
            && (button.kind == PieceKind::Kitten || can_place_cat);
        let selected_this = selected.0 == button.kind && enabled;

        *bg = BackgroundColor(if selected_this {
            Color::srgb(0.32, 0.38, 0.48)
        } else if enabled {
            Color::srgb(0.18, 0.2, 0.24)
        } else {
            Color::srgb(0.12, 0.13, 0.15)
        });
        *border = BorderColor::all(if selected_this {
            Color::srgb(0.85, 0.65, 0.25)
        } else {
            Color::srgb(0.35, 0.38, 0.42)
        });

        for child in children.iter() {
            if let Ok(mut color) = labels.get_mut(child) {
                *color = TextColor(if enabled {
                    Color::srgb(0.9, 0.9, 0.92)
                } else {
                    Color::srgb(0.45, 0.47, 0.5)
                });
            }
        }
    }
}

fn clamp_selected_piece(
    game_state: Res<GameState>,
    mut selected: ResMut<HumanPieceChoice>,
) {
    if selected.0 == PieceKind::Cat && game_state.pool(PLAYER_HUMAN).cats_in_hand == 0 {
        selected.0 = PieceKind::Kitten;
    }
}

#[allow(clippy::type_complexity)]
fn handle_piece_selector_clicks(
    game_state: Res<GameState>,
    interaction_state: Res<InteractionState>,
    mut selected: ResMut<HumanPieceChoice>,
    interactions: Query<
        (&Interaction, &PieceChoiceButton),
        (Changed<Interaction>, With<Button>),
    >,
) {
    if !matches!(
        *interaction_state,
        InteractionState::HumanPlace | InteractionState::HumanFullBed
    ) {
        return;
    }

    for (interaction, button) in interactions.iter() {
        if *interaction != Interaction::Pressed {
            continue;
        }
        if button.kind == PieceKind::Cat && game_state.pool(PLAYER_HUMAN).cats_in_hand == 0 {
            continue;
        }
        selected.0 = button.kind;
    }
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, setup_piece_selector)
        .add_systems(
            Update,
            (
                clamp_selected_piece,
                sync_piece_selector,
                handle_piece_selector_clicks,
            ),
        );
}
