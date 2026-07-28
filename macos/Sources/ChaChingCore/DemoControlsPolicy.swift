import Foundation

public enum DemoControlsPolicy {
    public static func shouldShowDemoControls(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        arguments: [String] = ProcessInfo.processInfo.arguments,
        userDefaultsEnabled: Bool = false
    ) -> Bool {
        environment["CHACHING_DEMO_CONTROLS"] == "1" ||
            arguments.contains("--chaching-demo-controls") ||
            userDefaultsEnabled
    }
}
