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

/// Prefer DX12 + compatibility limits on Windows native. Intel Iris Xe Vulkan has hung
/// after first present in the field; boop_gui avoids HDR/MSAA for the same GPU class.
#[cfg(all(not(target_arch = "wasm32"), target_os = "windows"))]
pub fn default_plugins() -> DefaultPlugins {
    use bevy::render::settings::Backends;
    use bevy::render::{
        RenderPlugin,
        settings::{RenderCreation, WgpuSettings, WgpuSettingsPriority},
    };

    DefaultPlugins.set(RenderPlugin {
        render_creation: RenderCreation::Automatic(WgpuSettings {
            backends: Some(Backends::DX12),
            priority: WgpuSettingsPriority::Compatibility,
            ..default()
        }),
        ..default()
    })
}

#[cfg(not(all(not(target_arch = "wasm32"), target_os = "windows")))]
pub fn default_plugins() -> DefaultPlugins {
    DefaultPlugins
}
