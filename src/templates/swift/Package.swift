// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "{{name}}",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "{{name}}",
            targets: ["App"]
        ),
    ],
    targets: [
        .target(
            name: "App",
            path: "Sources/App"
        ),
    ]
)
