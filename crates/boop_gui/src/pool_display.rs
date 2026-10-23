use bevy::prelude::*;
use boop::{Piece, PieceKind, Player};

use crate::{
    PLAYER_AI, PLAYER_HUMAN,
    graphics::{
        FOREGROUND_RENDER_LAYER, PieceMaterials, ScaleFactor, ScaleFactorSet, material_for,
        piece_mesh,
    },
    state_update::GameState,
};

#[derive(Component)]
struct PoolColumn {
    player: Player,
}

#[derive(Component)]
struct PoolCountLabel;

fn pool_anchor_x(scale_factor: &ScaleFactor, side: f32) -> f32 {
    let board_half = scale_factor.board_half_extent();
    side * (board_half + scale_factor.spacing * 1.45)
}

fn sync_pool_columns(
    mut commands: Commands,
    game_state: Res<GameState>,
    scale_factor: Res<ScaleFactor>,
    mut meshes: ResMut<Assets<Mesh>>,
    materials: Res<PieceMaterials>,
    columns: Query<(Entity, &PoolColumn)>,
    existing: Query<Entity, With<PoolCountLabel>>,
) {
    for entity in existing.iter() {
        commands.entity(entity).despawn();
    }

    let column_entities: Vec<(Entity, Player)> = if columns.is_empty() {
        [(PLAYER_HUMAN, -1.0), (PLAYER_AI, 1.0)]
            .into_iter()
            .map(|(player, side)| {
                let entity = commands
                    .spawn((
                        PoolColumn { player },
                        Transform::from_xyz(pool_anchor_x(&scale_factor, side), 0.0, 0.0),
                        Visibility::Visible,
                        FOREGROUND_RENDER_LAYER,
                    ))
                    .id();
                (entity, player)
            })
            .collect()
    } else {
        columns
            .iter()
            .map(|(entity, column)| (entity, column.player))
            .collect()
    };

    for (column_entity, player) in column_entities {
        let side = if player == PLAYER_HUMAN { -1.0 } else { 1.0 };
        let column = PoolColumn { player };
        commands.entity(column_entity).insert(Transform::from_xyz(
            pool_anchor_x(&scale_factor, side),
            0.0,
            0.0,
        ));

        let pool = game_state.pool(column.player);
        spawn_pool_stack(
            &mut commands,
            &mut meshes,
            &materials,
            &scale_factor,
            column_entity,
            column.player,
            side,
            "Kittens",
            pool.kittens_in_hand,
            PieceKind::Kitten,
            0,
        );
        spawn_pool_stack(
            &mut commands,
            &mut meshes,
            &materials,
            &scale_factor,
            column_entity,
            column.player,
            side,
            "Cats",
            pool.cats_in_hand,
            PieceKind::Cat,
            1,
        );
        spawn_pool_stack(
            &mut commands,
            &mut meshes,
            &materials,
            &scale_factor,
            column_entity,
            column.player,
            side,
            "Reserve",
            pool.cats_in_reserve,
            PieceKind::Cat,
            2,
        );
    }
}

#[allow(clippy::too_many_arguments)]
fn spawn_pool_stack(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &PieceMaterials,
    scale_factor: &ScaleFactor,
    _column: Entity,
    player: Player,
    side: f32,
    title: &str,
    count: u8,
    kind: PieceKind,
    row: i32,
) {
    let y = scale_factor.spacing * (1.8 - row as f32 * 1.35);
    let label_x = side * scale_factor.spacing * 0.55;

    commands.spawn((
        Text2d::new(format!("{title}: {count}")),
        TextFont {
            font_size: 14.0 * scale_factor.factor,
            ..default()
        },
        TextColor(Color::srgba(0.92, 0.92, 0.92, 0.95)),
        Transform::from_xyz(label_x, y + scale_factor.spacing * 0.35, 1.0),
        PoolCountLabel,
        FOREGROUND_RENDER_LAYER,
    ));

    let shown = count.min(5);
    for i in 0..shown {
        let piece = Piece { player, kind };
        let offset = (i as f32 - (shown as f32 - 1.0) * 0.5) * scale_factor.spacing * 0.22;
        commands.spawn((
            piece_mesh(
                meshes,
                material_for(materials, piece),
                kind,
                Visibility::Visible,
            ),
            Transform::from_xyz(offset, y, 0.0).with_scale(Vec3::splat(0.42 * scale_factor.factor)),
            PoolCountLabel,
            FOREGROUND_RENDER_LAYER,
        ));
    }
}

pub fn plugin(app: &mut App) {
    app.add_systems(Update, sync_pool_columns.after(ScaleFactorSet));
}
