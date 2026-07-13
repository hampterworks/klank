# MulticastLockPlugin is loaded reflectively by class name from Rust
# (register_android_plugin), so nothing statically references it - keep it so
# R8 doesn't rename or strip it in release builds.
-keep class io.github.hampterworks.klank.multicastlock.** { *; }
