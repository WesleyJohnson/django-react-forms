plugins {
    id("org.jetbrains.kotlin.jvm") version "2.4.21"
    id("org.jetbrains.intellij.platform") version "2.19.0"
}

group = "com.github.wesleyjohnson"
version = "0.1.0"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

// Build against a PyCharm you already have (-PlocalIde=/Applications/PyCharm.app, or the same line
// in ~/.gradle/gradle.properties) instead of downloading one.
val localIde = providers.gradleProperty("localIde").orNull

dependencies {
    intellijPlatform {
        if (localIde != null) local(localIde) else pycharm("2026.2.3")
        bundledPlugins("PythonCore", "JavaScript")
        testFramework(org.jetbrains.intellij.platform.gradle.TestFrameworkType.Platform)
    }
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.opentest4j:opentest4j:1.3.0")
}

// Compiles on whatever JDK 21+ runs Gradle and emits Java 21 bytecode, which PyCharm 2026.2 runs.
java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
}

intellijPlatform {
    buildSearchableOptions = false
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "262"
        }
    }
}
