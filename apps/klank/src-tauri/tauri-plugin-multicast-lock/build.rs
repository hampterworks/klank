const COMMANDS: &[&str] = &["acquire", "release"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
