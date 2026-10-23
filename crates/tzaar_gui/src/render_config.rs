use bevy::app::PluginGroupBuilder;
use bevy::prelude::*;
use bevy::render::{
    RenderApp, RenderPlugin,
    batching::gpu_preprocessing::{GpuPreprocessingMode, GpuPreprocessingSupport},
    settings::{Backends, RenderCreation, WgpuSettings, WgpuSettingsPriority},
};

const WINDOWS_NATIVE: bool = cfg!(all(not(target_arch = "wasm32"), target_os = "windows"));

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

/// Forces CPU mesh preprocessing. The 2D pipeline never uses the GPU path, and on
/// Intel Iris Xe (DX12) the GPU path needs 9 compute storage buffers but the limit is 8.
pub struct ForceCpuGpuPreprocessingPlugin;

impl Plugin for ForceCpuGpuPreprocessingPlugin {
    fn build(&self, _app: &mut App) {}

    fn finish(&self, app: &mut App) {
        let Some(render_app) = app.get_sub_app_mut(RenderApp) else {
            return;
        };
        render_app.insert_resource(GpuPreprocessingSupport {
            max_supported_mode: GpuPreprocessingMode::None,
        });
    }
}

/// Windows native prefers DX12 with WebGPU-compatible limits (Iris Xe Vulkan hangs after
/// first present); every other platform keeps Bevy's defaults.
fn render_plugin() -> RenderPlugin {
    if !WINDOWS_NATIVE {
        return RenderPlugin::default();
    }
    RenderPlugin {
        render_creation: RenderCreation::Automatic(WgpuSettings {
            backends: Some(Backends::DX12),
            priority: WgpuSettingsPriority::Compatibility,
            ..default()
        }),
        ..default()
    }
}

/// `DefaultPlugins` tuned for 2D Tzaar (no PBR) plus window and platform render settings.
pub fn plugin_group() -> PluginGroupBuilder {
    game_default_plugins()
        .set(render_plugin())
        .set(window_plugins())
}
