plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Single source of truth for the version: the `version` file at the repository root.
val appVersion: String = rootProject.file("../version").readText().trim()

fun versionCodeOf(v: String): Int {
    val p = v.split(".").map { it.toIntOrNull() ?: 0 }
    return p.getOrElse(0) { 0 } * 10000 + p.getOrElse(1) { 0 } * 100 + p.getOrElse(2) { 0 }
}

// Release signing: set ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS /
// ANDROID_KEY_PASSWORD (CI secrets). Without them the release APK is signed with the debug
// key so it is still installable.
val keystorePath: String? = System.getenv("ANDROID_KEYSTORE_PATH")
val hasReleaseKey = !keystorePath.isNullOrBlank() && file(keystorePath).exists()

android {
    namespace = "com.shahinst.cdnscanner"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.shahinst.cdnscanner"
        minSdk = 26
        targetSdk = 35
        versionCode = versionCodeOf(appVersion)
        versionName = appVersion
        vectorDrawables.useSupportLibrary = true
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                storeFile = file(keystorePath!!)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (hasReleaseKey) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.03")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("com.google.zxing:core:3.5.3")
    testImplementation("junit:junit:4.13.2")
}
