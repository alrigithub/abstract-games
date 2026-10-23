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

/// `DefaultPlugins` plus window (and on Windows native, DX12 + compatibility limits for Iris Xe).
pub fn plugin_group() -> PluginGroupBuilder {
    #[cfg(all(not(target_arch = "wasm32"), target_os = "windows"))]
    {
        use bevy::render::settings::Backends;
        use bevy::render::{
            RenderPlugin,
            settings::{RenderCreation, WgpuSettings, WgpuSettingsPriority},
        };

        return DefaultPlugins
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

    DefaultPlugins.set(window_plugins())
}
