// swift-tools-version: 5.10

import PackageDescription

let package = Package(
    name: "ChaChing",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "ChaChing", targets: ["ChaChing"])
    ],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.7.0")
    ],
    targets: [
        .target(name: "ChaChingCore"),
        .executableTarget(
            name: "ChaChing",
            dependencies: [
                "ChaChingCore",
                .product(name: "Sparkle", package: "Sparkle")
            ],
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "ChaChingCoreTests",
            dependencies: ["ChaChingCore"]
        )
    ]
)
