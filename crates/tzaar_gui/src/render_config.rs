use bevy::app::PluginGroupBuilder;
use bevy::prelude::*;

/// Window + rendering defaults shared by native and WASM entrypoints.
pub fn window_plugins() -> WindowPlugin {
    WindowPlugin {
        primary_window: Some(Window {
            title: "Tzaar".into(),
            name: Some("tzaar".into()),
            resolution: bevy::window::WindowResolution::new(900, 820),
            mode: bevy::window::WindowMode::Windowed,
            canvas: Some("#tzaar-canvas".into()),
            ..default()
        }),
        ..default()
    }
}

/// 2D Tzaar does not use 3D PBR (atmosphere, environment maps, mesh GPU preprocess bind groups).
fn game_default_plugins() -> PluginGroupBuilder {
    use bevy::animation::AnimationPlugin;
    use bevy::gltf::GltfPlugin;
    use bevy::pbr::PbrPlugin;

    DefaultPlugins
        .build()
        .disable::<PbrPlugin>()
        .disable::<GltfPlugin>()
        .disable::<AnimationPlugin>()
}

/// On Windows Iris Xe DX12, GPU mesh preprocessing needs 9 storage buffers but the driver limit is 8.
#[cfg(all(not(target_arch = "wasm32"), target_os = "windows"))]
pub struct ForceCpuGpuPreprocessingPlugin;

#[cfg(all(not(target_arch = "wasm32"), target_os = "windows"))]
impl Plugin for ForceCpuGpuPreprocessingPlugin {
    fn finish(&self, app: &mut App) {
        use bevy::render::{
            batching::gpu_preprocessing::{GpuPreprocessingMode, GpuPreprocessingSupport},
            RenderApp,
        };

        let Some(render_app) = app.get_sub_app_mut(RenderApp) else {
            return;
        };
        render_app.insert_resource(GpuPreprocessingSupport {
            max_supported_mode: GpuPreprocessingMode::None,
        });
    }
}

/// `DefaultPlugins` tuned for 2D Tzaar (no PBR) plus window and optional Windows DX12 settings.
pub fn plugin_group() -> PluginGroupBuilder {
    #[cfg(all(not(target_arch = "wasm32"), target_os = "windows"))]
    {
        use bevy::render::settings::Backends;
        use bevy::render::{
            RenderPlugin,
            settings::{RenderCreation, WgpuSettings, WgpuSettingsPriority},
        };

        return game_default_plugins()
            .set(RenderPlugin {
                render_creation: RenderCreation::Automatic(WgpuSettings {
                    backends: Some(Backends::DX12),
                    priority: WgpuSettingsPriority::Compatibility,
                    ..default()
                }),
                ..default()
            })
            .set(window_plugins());
    }

    game_default_plugins().set(window_plugins())
}
