use bevy::prelude::*;
use boop::{Player, Pool};

use crate::{
    PLAYER_AI, PLAYER_HUMAN,
    graphics::{ScaleFactor, ScaleFactorSet},
    state_update::GameState,
};

#[derive(Component)]
struct PoolPanelRoot {
    player: Player,
}

#[derive(Component)]
struct PoolLineText;

/// Avoid rebuilding side panels every frame (was leaking meshes and crashing after ~1 min).
#[derive(Resource, Debug, Clone, Copy, PartialEq, Eq)]
struct PoolDisplayFingerprint {
    human: Pool,
    ai: Pool,
    spacing_bits: u32,
}

impl PoolDisplayFingerprint {
    fn from_state(game_state: &GameState, scale_factor: &ScaleFactor) -> Self {
        Self {
            human: game_state.pool(PLAYER_HUMAN),
            ai: game_state.pool(PLAYER_AI),
            spacing_bits: scale_factor.spacing.to_bits(),
        }
    }
}

fn setup_pool_panels(mut commands: Commands) {
    for player in [PLAYER_HUMAN, PLAYER_AI] {
        let align = if player == PLAYER_HUMAN {
            (Val::Px(8.0), Val::Auto)
        } else {
            (Val::Auto, Val::Px(8.0))
        };
        commands.spawn((
            PoolPanelRoot { player },
            Node {
                position_type: PositionType::Absolute,
                top: Val::Px(110.0),
                left: align.0,
                right: align.1,
                width: Val::Px(118.0),
                flex_direction: FlexDirection::Column,
                row_gap: Val::Px(10.0),
                ..default()
            },
        ));
    }
}

fn sync_pool_panels(
    game_state: Res<GameState>,
    scale_factor: Res<ScaleFactor>,
    mut fingerprint: Local<Option<PoolDisplayFingerprint>>,
    roots: Query<(Entity, &PoolPanelRoot)>,
    lines: Query<Entity, With<PoolLineText>>,
    mut commands: Commands,
) {
    let next = PoolDisplayFingerprint::from_state(&game_state, &scale_factor);
    if fingerprint.as_ref() == Some(&next) {
        return;
    }
    *fingerprint = Some(next);

    for entity in lines.iter() {
        commands.entity(entity).despawn();
    }

    for (root, panel) in roots.iter() {
        let pool = game_state.pool(panel.player);
        let title = if panel.player == PLAYER_HUMAN {
            "You"
        } else {
            "AI"
        };
        spawn_pool_lines(&mut commands, root, title, &pool);
    }
}

fn spawn_pool_lines(commands: &mut Commands, root: Entity, title: &str, pool: &Pool) {
    commands.entity(root).with_children(|parent| {
        parent.spawn((
            Text::new(title),
            TextFont {
                font_size: 16.0,
                ..default()
            },
            TextColor(Color::srgb(0.95, 0.92, 0.85)),
            PoolLineText,
        ));
        for (label, count, glyph) in [
            ("Kittens", pool.kittens_in_hand, "▪"),
            ("Cats", pool.cats_in_hand, "●"),
            ("Reserve", pool.cats_in_reserve, "◆"),
        ] {
            let stack = stack_glyph_line(glyph, count);
            parent.spawn((
                Text::new(format!("{label}: {count}\n{stack}")),
                TextFont {
                    font_size: 14.0,
                    ..default()
                },
                TextColor(Color::srgb(0.82, 0.84, 0.88)),
                PoolLineText,
            ));
        }
    });
}

fn stack_glyph_line(glyph: &str, count: u8) -> String {
    let shown = count.min(8) as usize;
    glyph.repeat(shown)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fingerprint_skips_identical_state() {
        let a = PoolDisplayFingerprint {
            human: Pool {
                kittens_in_hand: 5,
                cats_in_hand: 1,
                cats_in_reserve: 8,
            },
            ai: Pool::new(),
            spacing_bits: 1.0f32.to_bits(),
        };
        let b = a;
        assert_eq!(a, b);
    }

    #[test]
    fn stack_glyph_caps_at_eight() {
        assert_eq!(stack_glyph_line("●", 12).chars().count(), 8);
    }
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, setup_pool_panels)
        .add_systems(Update, sync_pool_panels.after(ScaleFactorSet));
}
