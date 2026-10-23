use abstract_gui_theme::{ai_strength_button_hover, ai_strength_panel};
use bevy::prelude::*;

use crate::ai::AiPlayerStrength;
use crate::graphics::BACKGROUND_RENDER_LAYER;

pub const AI_STRENGTH_MIN: usize = 1;
pub const AI_STRENGTH_MAX: usize = 24;

#[derive(Component)]
struct AiStrengthUiRoot;

#[derive(Component)]
struct AiStrengthValueLabel;

#[derive(Component)]
enum AiStrengthAdjust {
    Decrease,
    Increase,
}

pub fn adjust_ai_strength(strength: &mut AiPlayerStrength, delta: i32) {
    let next = strength.0 as i32 + delta;
    strength.0 = next.clamp(AI_STRENGTH_MIN as i32, AI_STRENGTH_MAX as i32) as usize;
}

fn setup_ai_strength_ui(mut commands: Commands) {
    let (panel_bg, border, text_color) = ai_strength_panel();

    commands
        .spawn((
            AiStrengthUiRoot,
            Node {
                position_type: PositionType::Absolute,
                bottom: Val::Px(12.),
                left: Val::Px(12.),
                padding: UiRect::all(Val::Px(10.)),
                column_gap: Val::Px(8.),
                row_gap: Val::Px(4.),
                flex_direction: FlexDirection::Column,
                border: UiRect::all(Val::Px(1.)),
                ..default()
            },
            BackgroundColor(panel_bg),
            BorderColor::all(border),
            BACKGROUND_RENDER_LAYER,
        ))
        .with_children(|panel| {
            panel.spawn((
                Text::new("AI strength (search depth)"),
                TextFont {
                    font_size: 13.0,
                    ..default()
                },
                TextColor(text_color.with_alpha(0.75)),
            ));

            panel
                .spawn(Node {
                    flex_direction: FlexDirection::Row,
                    column_gap: Val::Px(8.),
                    align_items: AlignItems::Center,
                    ..default()
                })
                .with_children(|row| {
                    spawn_step_button(row, "−", AiStrengthAdjust::Decrease, border, text_color);
                    row.spawn((
                        AiStrengthValueLabel,
                        Text::new("—"),
                        TextFont {
                            font_size: 22.0,
                            ..default()
                        },
                        TextColor(text_color),
                        Node {
                            min_width: Val::Px(36.),
                            justify_content: JustifyContent::Center,
                            ..default()
                        },
                    ));
                    spawn_step_button(row, "+", AiStrengthAdjust::Increase, border, text_color);
                });

            panel.spawn((
                Text::new("PgUp / PgDn also adjust"),
                TextFont {
                    font_size: 11.0,
                    ..default()
                },
                TextColor(text_color.with_alpha(0.55)),
            ));
        });
}

fn spawn_step_button(
    parent: &mut ChildSpawnerCommands,
    label: &str,
    adjust: AiStrengthAdjust,
    border: Color,
    text_color: Color,
) {
    parent
        .spawn((
            Button,
            adjust,
            Node {
                width: Val::Px(40.),
                height: Val::Px(36.),
                justify_content: JustifyContent::Center,
                align_items: AlignItems::Center,
                border: UiRect::all(Val::Px(1.)),
                ..default()
            },
            BorderColor::all(border),
            BackgroundColor(ai_strength_button_hover()),
        ))
        .with_child((
            Text::new(label),
            TextFont {
                font_size: 20.0,
                ..default()
            },
            TextColor(text_color),
        ));
}

fn sync_ai_strength_label(
    strength: Res<AiPlayerStrength>,
    mut q: Query<&mut Text, With<AiStrengthValueLabel>>,
) {
    let Ok(mut text) = q.single_mut() else {
        return;
    };
    **text = strength.0.to_string();
}

fn handle_ai_strength_buttons(
    mut strength: ResMut<AiPlayerStrength>,
    q: Query<(&Interaction, &AiStrengthAdjust), (Changed<Interaction>, With<Button>)>,
) {
    for (interaction, adjust) in q.iter() {
        if *interaction != Interaction::Pressed {
            continue;
        }
        match adjust {
            AiStrengthAdjust::Decrease => adjust_ai_strength(&mut strength, -1),
            AiStrengthAdjust::Increase => adjust_ai_strength(&mut strength, 1),
        }
    }
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, setup_ai_strength_ui)
        .add_systems(Update, (sync_ai_strength_label, handle_ai_strength_buttons));
}
