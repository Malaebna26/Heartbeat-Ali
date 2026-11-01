import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    // namespace هو اسم حزمة الشيفرة الداخلي، ويبقى كما هو. معرّف النشر على Play هو applicationId أدناه (لا يُغيَّر بعد أول رفع).
    namespace = "com.example.nabadatrabie"

    compileSdk = 36

    defaultConfig {
        applicationId = "dz.alidz.nabadatrabie"
        minSdk = 26
        targetSdk = 36          // Google Play يشترط 36 للتحديثات والتطبيقات الجديدة منذ 31 أغسطس 2026
        versionCode = 1         // ارفع الرقم عند كل إصدار جديد (2، 3، ...)
        versionName = "1.0.0"
    }

    buildFeatures { buildConfig = true }

    // نسختان من التطبيق نفسه:
    //  play   : لـ Google Play، كل الميزات مفتوحة مجاناً (لا يُسمح بالدفع خارج Play مقابل ميزات داخل التطبيق).
    //  direct : للتوزيع المباشر كملف APK، ميزات التصدير مقفلة حتى إدخال كود التفعيل.
    flavorDimensions += "dist"
    productFlavors {
        create("play") {
            dimension = "dist"
            buildConfigField("boolean", "LOCK_MODE", "false")
        }
        create("direct") {
            dimension = "dist"
            applicationIdSuffix = ".direct"
            versionNameSuffix = "-direct"
            buildConfigField("boolean", "LOCK_MODE", "true")
        }
    }

    signingConfigs {
        create("release") {
            if (keystoreProps.containsKey("storeFile")) {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystoreProps.containsKey("storeFile")) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    bundle {
        language { enableSplit = true }
        density { enableSplit = true }
        abi { enableSplit = true }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
