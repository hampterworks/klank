import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// Release signing. Populated from a gitignored keystore.properties (local dev)
// or written by CI from the KEYSTORE_* secrets before the build runs. Absent
// either way, release builds fall back to unsigned (installable only via
// `adb install -r` with signature checks disabled, not a real distribution).
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        keystorePropertiesFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 36
    namespace = "io.github.hampterworks.klank"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "io.github.hampterworks.klank"
        minSdk = 24
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    signingConfigs {
        val keyAlias = keystoreProperties.getProperty("keyAlias")
        val keyPassword = keystoreProperties.getProperty("keyPassword")
        val storeFile = keystoreProperties.getProperty("storeFile")
        val storePassword = keystoreProperties.getProperty("storePassword")
        if (!keyAlias.isNullOrEmpty() && !keyPassword.isNullOrEmpty() &&
            !storeFile.isNullOrEmpty() && !storePassword.isNullOrEmpty()
        ) {
            create("release") {
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
                this.storeFile = file(storeFile)
                this.storePassword = storePassword
            }
        } else {
            println("Warning: no keystore.properties found. Release APK will be unsigned.")
        }
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            // Native .so debug symbols are left to AGP's default stripping so the
            // debug APK stays small; the Rust dev profile is untouched, so local
            // `tauri:android:dev` incremental builds are unaffected.
        }
        getByName("release") {
            // Jam mode connects a guest WebView to the host over plain ws:// on a
            // bare LAN IP, which has no TLS cert — so cleartext must be permitted
            // even in release. The app makes no other cleartext requests (UG
            // scraping is HTTPS), so the exposure is limited to LAN jam traffic.
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
            if (signingConfigs.findByName("release") != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")