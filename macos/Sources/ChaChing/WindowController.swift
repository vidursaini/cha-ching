import AppKit
import SwiftUI

final class WindowController<Content: View>: NSWindowController {
    private let onClose: () -> Void
    private var observer: NSObjectProtocol?

    init(title: String, size: NSSize, rootView: Content, onClose: @escaping () -> Void) {
        self.onClose = onClose
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = title
        window.isRestorable = false
        window.contentMinSize = size
        window.contentMaxSize = size

        let hostingView = NSHostingView(
            rootView: rootView.frame(
                width: size.width,
                height: size.height,
                alignment: .topLeading
            )
        )
        hostingView.frame = NSRect(origin: .zero, size: size)
        window.contentView = hostingView
        window.setContentSize(size)
        window.center()
        super.init(window: window)
        observer = NotificationCenter.default.addObserver(
            forName: NSWindow.willCloseNotification,
            object: window,
            queue: .main
        ) { [weak self] _ in
            self?.onClose()
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        if let observer {
            NotificationCenter.default.removeObserver(observer)
        }
    }
}
