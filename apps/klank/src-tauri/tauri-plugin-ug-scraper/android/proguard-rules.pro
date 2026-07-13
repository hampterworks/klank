# UgScraperPlugin is loaded reflectively by class name from Rust
# (register_android_plugin), so nothing statically references it - keep it and
# its JS-facing bridge so R8 doesn't rename or strip them in release builds.
-keep class io.github.hampterworks.klank.ugscraper.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
