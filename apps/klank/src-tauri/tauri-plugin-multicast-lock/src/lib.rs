//! Android-only Tauri plugin that holds a Wi-Fi `MulticastLock`.
//!
//! Android drops inbound multicast/broadcast packets by default to save power,
//! so mDNS jam discovery (advertise + browse) can't send and receive on the LAN
//! unless a `MulticastLock` is held. Jam mode acquires the lock while hosting or
//! discovering and releases it when done.
//!
//! The lock is reference-counted on the Android side: every [`MulticastLock::acquire`]
//! must be matched by one [`MulticastLock::release`], so an overlapping host +
//! discovery hold composes correctly.
//!
//! On non-Android targets this is a no-op shell so the crate still compiles and
//! can be registered unconditionally.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(target_os = "android")]
use {
    serde::{Deserialize, Serialize},
    tauri::plugin::PluginHandle,
    tauri::Manager,
};

/// Empty payload for the no-argument commands.
#[cfg(target_os = "android")]
#[derive(Serialize)]
struct NoArgs {}

/// Empty `{}` resolve from the Android side.
#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct Empty {}

/// Handle to the registered Android plugin.
#[cfg(target_os = "android")]
pub struct MulticastLock<R: Runtime>(PluginHandle<R>);

#[cfg(target_os = "android")]
impl<R: Runtime> MulticastLock<R> {
    /// Acquire (reference-counted) the Wi-Fi multicast lock.
    pub fn acquire(&self) -> Result<(), String> {
        self.0
            .run_mobile_plugin::<Empty>("acquire", NoArgs {})
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    /// Release one reference of the Wi-Fi multicast lock.
    pub fn release(&self) -> Result<(), String> {
        self.0
            .run_mobile_plugin::<Empty>("release", NoArgs {})
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

/// Extension trait to reach the plugin from an `AppHandle`/`Manager`.
#[cfg(target_os = "android")]
pub trait MulticastLockExt<R: Runtime> {
    fn multicast_lock(&self) -> &MulticastLock<R>;
}

#[cfg(target_os = "android")]
impl<R: Runtime, T: Manager<R>> MulticastLockExt<R> for T {
    fn multicast_lock(&self) -> &MulticastLock<R> {
        self.state::<MulticastLock<R>>().inner()
    }
}

/// Initializes the plugin. On non-Android targets this is a no-op shell.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("multicast-lock")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle = _api.register_android_plugin(
                    "io.github.hampterworks.klank.multicastlock",
                    "MulticastLockPlugin",
                )?;
                _app.manage(MulticastLock(handle));
            }
            Ok(())
        })
        .build()
}
