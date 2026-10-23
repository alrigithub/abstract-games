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

/// Device limits that disable compute so Bevy uses CPU mesh preprocessing (2D-safe on iGPUs).
#[cfg(all(not(target_arch = "wasm32"), target_os = "windows"))]
fn windows_wgpu_limits() -> bevy::render::settings::WgpuLimits {
    use bevy::render::settings::WgpuLimits;

    let mut limits = WgpuLimits::default();
    // Iris Xe DX12 reports compute but `max_storage_buffers_per_shader_stage` is 8 while
    // Bevy's GPU mesh preprocessing bind group needs 9 — force the CPU path instead.
    limits.max_compute_workgroup_size_x = 0;
    limits.max_compute_workgroup_size_y = 0;
    limits.max_compute_workgroup_size_z = 0;
    limits.max_compute_invocations_per_workgroup = 0;
    limits.max_compute_workgroups_per_dimension = 0;
    limits.max_compute_workgroup_storage_size = 0;
    limits
}

/// `DefaultPlugins` plus window (and on Windows native, DX12 + iGPU-safe limits).
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
                    limits: windows_wgpu_limits(),
                    ..default()
                }),
                ..default()
            })
            .set(window_plugins());
    }

    DefaultPlugins.set(window_plugins())
}
