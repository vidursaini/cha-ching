import AppKit

@main
enum ChaChingMain {
    @MainActor private static let delegate = ChaChingAppDelegate()

    @MainActor
    static func main() {
        let app = NSApplication.shared
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        app.run()
    }
}
