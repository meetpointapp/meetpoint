allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Eski usul eklentiler (ör. agora_rtc_engine) derleme SDK'sını buradan okur; yoksa Android 31'e düşer
// ve AndroidX bağımlılıkları (en az 34 ister) derlenmez.
extra["compileSdkVersion"] = 37

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
