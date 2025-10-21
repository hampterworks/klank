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

// Load keystore properties with environment variable support
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()

// Function to resolve environment variables in property values
fun resolveProperty(value: String?): String? {
    if (value == null) return null
    val envVarPattern = Regex("\\$\\{([^}]+)}")
    return envVarPattern.replace(value) { matchResult ->
        val parts = matchResult.groupValues[1].split(":-", limit = 2)
        val envVarName = parts[0]
        val defaultValue = if (parts.size > 1) parts[1] else ""
        System.getenv(envVarName) ?: defaultValue.ifEmpty { null }
    }
}

if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
}

android {
    compileSdk = 34
    namespace = "home.klank"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "home.klank"
        minSdk = 24
        targetSdk = 34
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }

    // Add signing configurations
    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            val keyAlias = resolveProperty(keystoreProperties["keyAlias"] as String?)
            val keyPassword = resolveProperty(keystoreProperties["keyPassword"] as String?)
            val storeFile = resolveProperty(keystoreProperties["storeFile"] as String?)
            val storePassword = resolveProperty(keystoreProperties["storePassword"] as String?)
            
            // Only create release config if all required values are present
            if (keyAlias != null && keyPassword != null && storeFile != null && storePassword != null) {
                create("release") {
                    this.keyAlias = keyAlias
                    this.keyPassword = keyPassword
                    this.storeFile = file(storeFile)
                    this.storePassword = storePassword
                }
            } else {
                println("Warning: Missing keystore configuration. Release builds will not be signed.")
            }
        }
    }

    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
            // Only add signing config if it exists
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
    implementation("androidx.webkit:webkit:1.6.1")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.8.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")