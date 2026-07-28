import AppKit
import ChaChingCore
import OSLog
import Sparkle
import SwiftUI
import UserNotifications

@MainActor
final class ChaChingAppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private let logger = Logger(subsystem: "com.vidur.chaching", category: "poll")
    private var settings = AppSettings()
    private let cursorStore = CursorStore()
    private let formatter = RevenueEventFormatter()
    private var statusItem: NSStatusItem?
    private var pollTimer: Timer?
    private var pollGeneration = UUID()
    private var consecutivePollingFailures = 0
    private var latestEvent: RevenueEvent?
    private var latestSummary: RevenueSummary?
    private var activationWindow: NSWindowController?
    private var revenueCardWindow: NSWindowController?
    private var celebrationWindow: NSWindowController?
    private var notificationWindow: NSWindowController?
    private var notificationDismissWorkItem: DispatchWorkItem?
    private var delayedDemoCelebrationWorkItem: DispatchWorkItem?
    private var lastPollingError: String?
    private var isPolling = false
    private let popupAutoDismissDelay: TimeInterval = 8
    private let updaterController = SPUStandardUpdaterController(
        startingUpdater: AppRuntimeConfiguration.current.capabilities.supportsOfficialUpdates,
        updaterDelegate: nil,
        userDriverDelegate: nil
    )

    func applicationDidFinishLaunching(_ notification: Notification) {
        configureMainMenu()
        configureStatusItem()
        requestNotifications()
        if !isAutoDemoRequested {
            startPolling()
        }
        showConnectWindowIfNeeded()
        showAutoDemoIfRequested()
    }

    func applicationWillTerminate(_ notification: Notification) {
        pollTimer?.invalidate()
    }

    private func configureStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        item.button?.image = ChaChingIcon.menuBarImage()
        item.button?.imagePosition = .imageOnly
        item.menu = makeMenu()
        statusItem = item
    }

    private func configureMainMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu(title: "Cha-Ching")
        let quit = NSMenuItem(title: "Quit Cha-Ching", action: #selector(quit), keyEquivalent: "q")
        quit.target = self
        appMenu.addItem(quit)
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        for command in StandardEditMenu.commands {
            if command.title == "Cut" {
                editMenu.addItem(.separator())
            }
            if command.title == "Select All" {
                editMenu.addItem(.separator())
            }

            let item = NSMenuItem(
                title: command.title,
                action: NSSelectorFromString(command.selectorName),
                keyEquivalent: command.keyEquivalent
            )
            item.target = nil
            editMenu.addItem(item)
        }
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        NSApp.mainMenu = mainMenu
    }

    private func makeMenu() -> NSMenu {
        let menu = NSMenu()
        menu.delegate = self
        return menu
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        menu.addItem(NSMenuItem(title: "Cha-Ching", action: nil, keyEquivalent: ""))
        if let latestSummary {
            menu.addItem(NSMenuItem(title: "Today: \(money(latestSummary.todayRevenue)) across \(latestSummary.todayEvents) events", action: nil, keyEquivalent: ""))
        } else {
            menu.addItem(NSMenuItem(title: "Today: waiting for revenue", action: nil, keyEquivalent: ""))
        }
        if let latestEvent {
            menu.addItem(NSMenuItem(title: "Latest: \(formatter.title(for: latestEvent))", action: nil, keyEquivalent: ""))
        }
        if let lastPollingError {
            menu.addItem(NSMenuItem(title: "Backend: \(lastPollingError)", action: nil, keyEquivalent: ""))
        }
        menu.addItem(.separator())

        let activate = NSMenuItem(title: "Connect Revenue Sources...", action: #selector(openActivation), keyEquivalent: "")
        activate.target = self
        menu.addItem(activate)

        let card = NSMenuItem(title: "Open Revenue Card", action: #selector(openRevenueCard), keyEquivalent: "r")
        card.target = self
        menu.addItem(card)

        if shouldShowDemoControls {
            let delayedThree = NSMenuItem(title: DemoCelebrationOptions.delayedOptions[0].title, action: #selector(testCelebrationAfterThreeSeconds), keyEquivalent: "t")
            delayedThree.target = self
            menu.addItem(delayedThree)

            let delayedFive = NSMenuItem(title: DemoCelebrationOptions.delayedOptions[1].title, action: #selector(testCelebrationAfterFiveSeconds), keyEquivalent: "")
            delayedFive.target = self
            menu.addItem(delayedFive)

            let immediate = NSMenuItem(title: "Test Celebration Now", action: #selector(testCelebrationNow), keyEquivalent: "")
            immediate.target = self
            menu.addItem(immediate)

            let demo = NSMenuItem(title: effectiveDemoMode ? "Disable Demo Mode" : "Enable Demo Mode", action: #selector(toggleDemoMode), keyEquivalent: "")
            demo.target = self
            menu.addItem(demo)
        }

        let mute = NSMenuItem(title: settings.muteCelebrations ? "Unmute" : "Mute", action: #selector(toggleMute), keyEquivalent: "")
        mute.target = self
        menu.addItem(mute)

        let autoDismiss = NSMenuItem(title: "Auto-Close Popups", action: #selector(toggleAutoDismissPopups), keyEquivalent: "")
        autoDismiss.target = self
        autoDismiss.state = settings.autoDismissPopups ? .on : .off
        menu.addItem(autoDismiss)

        menu.addItem(.separator())

        if AppRuntimeConfiguration.current.capabilities.supportsOfficialUpdates {
            let update = NSMenuItem(
                title: "Check for Updates...",
                action: #selector(SPUStandardUpdaterController.checkForUpdates(_:)),
                keyEquivalent: ""
            )
            update.target = updaterController
            menu.addItem(update)
        }

        let quit = NSMenuItem(title: "Quit Cha-Ching", action: #selector(quit), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
    }

    private func startPolling() {
        pollTimer?.invalidate()
        let generation = UUID()
        pollGeneration = generation
        Task { @MainActor [weak self] in
            guard let self else { return }
            let result = await self.poll()
            self.scheduleNextPoll(after: result, generation: generation)
        }
    }

    private func scheduleNextPoll(after result: PollingResult, generation: UUID) {
        guard generation == pollGeneration else { return }
        pollTimer?.invalidate()
        pollTimer = Timer.scheduledTimer(withTimeInterval: PollingSchedule.interval(after: result), repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, generation == self.pollGeneration else { return }
                let nextResult = await self.poll()
                self.scheduleNextPoll(after: nextResult, generation: generation)
            }
        }
    }

    private func poll() async -> PollingResult {
        guard !isPolling else { return .idle(serverSuggestion: 30) }
        logger.info("poll starting")
        let deviceToken = KeychainStore.read("deviceToken")
        logger.info("poll config demoMode=\(self.effectiveDemoMode) hasToken=\(deviceToken != nil) baseURL=\(self.settings.baseURLString, privacy: .public)")
        if PollingModeResolver.shouldUseDemoOnly(demoMode: effectiveDemoMode, hasDeviceToken: deviceToken != nil) {
            latestSummary = demoSummary()
            logger.info("poll using demo-only mode")
            return .idle(serverSuggestion: 60)
        }
        guard let client = makeClient(),
              let deviceToken
        else {
            lastPollingError = deviceToken == nil ? "not activated" : "bad backend URL"
            logger.error("poll stopped: \(self.lastPollingError ?? "unknown", privacy: .public)")
            return .notConfigured
        }

        isPolling = true
        defer { isPolling = false }

        do {
            let response = try await client.fetchSync(deviceToken: deviceToken, after: cursorStore.load())
            let events = response.events
            logger.info("poll fetched events count=\(events.count) after=\(self.cursorStore.load())")
            for event in events where event.isCelebratory {
                handle(event)
            }
            cursorStore.saveAfterProcessing(events)
            latestSummary = response.summary
            lastPollingError = nil
            consecutivePollingFailures = 0
            logger.info("poll completed latestCursor=\(self.cursorStore.load())")
            return events.isEmpty
                ? .idle(serverSuggestion: response.pollAfterSeconds)
                : .eventsReceived(serverSuggestion: response.pollAfterSeconds)
        } catch {
            lastPollingError = "poll failed"
            consecutivePollingFailures += 1
            logger.error("poll failed: \(String(describing: error), privacy: .public)")
            return .failure(consecutiveFailures: consecutivePollingFailures)
        }
    }

    private func handle(_ event: RevenueEvent) {
        latestEvent = event
        showCelebration(for: event)
    }

    private func makeClient() -> APIClient? {
        guard let url = URL(string: settings.baseURLString) else { return nil }
        return APIClient(baseURL: url)
    }

    private func showNotification(for event: RevenueEvent) {
        guard canUseUserNotifications else { return }

        let content = UNMutableNotificationContent()
        content.title = formatter.title(for: event)
        content.body = formatter.notificationBody(for: event)
        content.sound = nil
        let request = UNNotificationRequest(identifier: event.sourceEventId, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    private func showCelebration(for event: RevenueEvent) {
        showConfetti()
        showRevenuePopup(for: event)
    }

    private func showConfetti() {
        celebrationWindow?.close()
        let view = CelebrationEffectsView(muted: settings.muteCelebrations)
        let window = NSPanel(
            contentRect: NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1280, height: 800),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        window.level = .screenSaver
        window.backgroundColor = .clear
        window.isOpaque = false
        window.ignoresMouseEvents = true
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        window.contentView = NSHostingView(rootView: view)
        let controller = NSWindowController(window: window)
        celebrationWindow = controller
        controller.showWindow(nil)

        DispatchQueue.main.asyncAfter(deadline: .now() + 3.55) { [weak self] in
            self?.celebrationWindow?.close()
            self?.celebrationWindow = nil
        }
    }

    private func showRevenuePopup(for event: RevenueEvent) {
        closeRevenuePopup()

        let size = NSSize(width: 430, height: 176)
        let visibleFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
        let origin = NSPoint(
            x: visibleFrame.maxX - size.width - 14,
            y: visibleFrame.maxY - size.height - 12
        )

        let view = RevenueNotificationToast(
            event: event,
            formatter: formatter,
            onOpenRevenueCard: { [weak self] in
                self?.openRevenueCard()
                self?.closeRevenuePopup()
            },
            onDismiss: { [weak self] in
                self?.closeRevenuePopup()
            }
        )
        .frame(width: size.width, height: size.height, alignment: .topLeading)

        let window = NSPanel(
            contentRect: NSRect(origin: origin, size: size),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        window.level = .screenSaver
        window.backgroundColor = .clear
        window.isOpaque = false
        window.hasShadow = false
        window.ignoresMouseEvents = false
        window.hidesOnDeactivate = false
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        let hostingView = NSHostingView(rootView: view)
        hostingView.wantsLayer = true
        hostingView.layer?.backgroundColor = NSColor.clear.cgColor
        hostingView.layer?.isOpaque = false
        window.contentView = hostingView

        let controller = NSWindowController(window: window)
        notificationWindow = controller
        controller.showWindow(nil)
        scheduleRevenuePopupDismissIfNeeded()
    }

    private func closeRevenuePopup() {
        notificationDismissWorkItem?.cancel()
        notificationDismissWorkItem = nil
        notificationWindow?.close()
        notificationWindow = nil
    }

    private func scheduleRevenuePopupDismissIfNeeded() {
        notificationDismissWorkItem?.cancel()
        notificationDismissWorkItem = nil
        guard settings.autoDismissPopups, notificationWindow != nil else { return }

        let workItem = DispatchWorkItem { [weak self] in
            self?.closeRevenuePopup()
        }
        notificationDismissWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + popupAutoDismissDelay, execute: workItem)
    }

    @objc private func openActivation() {
        if activationWindow == nil {
            let view = ActivationView(
                settings: settings,
                deviceToken: KeychainStore.read("deviceToken"),
                onSave: { [weak self] updatedSettings, deviceToken, closeWindow in
                    self?.settings = updatedSettings
                    if let deviceToken {
                        KeychainStore.write(deviceToken, account: "deviceToken")
                    }
                    if closeWindow {
                        self?.activationWindow?.close()
                        self?.activationWindow = nil
                    }
                    self?.startPolling()
                }
            )
            activationWindow = WindowController(title: "Connect Cha-Ching", size: NSSize(width: 620, height: 720), rootView: view) { [weak self] in
                self?.activationWindow = nil
            }
        }
        NSApp.activate(ignoringOtherApps: true)
        activationWindow?.showWindow(nil)
    }

    @objc private func openRevenueCard() {
        let summary = latestSummary ?? (effectiveDemoMode ? demoSummary() : emptySummary())
        let view = RevenueCardView(summary: summary)
        revenueCardWindow = WindowController(title: "Revenue Card", size: NSSize(width: 640, height: 760), rootView: view) { [weak self] in
            self?.revenueCardWindow = nil
        }
        NSApp.activate(ignoringOtherApps: true)
        revenueCardWindow?.showWindow(nil)
    }

    @objc private func testCelebrationNow() {
        handle(DemoEventFactory.events().randomElement()!)
    }

    @objc private func testCelebrationAfterThreeSeconds() {
        scheduleDemoCelebration(after: DemoCelebrationOptions.delayedOptions[0].delay)
    }

    @objc private func testCelebrationAfterFiveSeconds() {
        scheduleDemoCelebration(after: DemoCelebrationOptions.delayedOptions[1].delay)
    }

    private func scheduleDemoCelebration(after delay: TimeInterval) {
        delayedDemoCelebrationWorkItem?.cancel()
        let workItem = DispatchWorkItem { [weak self] in
            self?.testCelebrationNow()
        }
        delayedDemoCelebrationWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
    }

    @objc private func toggleMute() {
        settings.muteCelebrations.toggle()
    }

    @objc private func toggleAutoDismissPopups() {
        settings.autoDismissPopups.toggle()
        if settings.autoDismissPopups {
            scheduleRevenuePopupDismissIfNeeded()
        } else {
            notificationDismissWorkItem?.cancel()
            notificationDismissWorkItem = nil
        }
    }

    @objc private func toggleDemoMode() {
        settings.demoMode.toggle()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }

    private func requestNotifications() {
        guard canUseUserNotifications else { return }

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    private func showAutoDemoIfRequested() {
        guard isAutoDemoRequested else { return }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
            guard let self else { return }
            self.handle(DemoEventFactory.events().first!)
        }
    }

    private func showConnectWindowIfNeeded() {
        let shouldOpen = FirstRunActivationPolicy.shouldOpenConnectWindow(
            hasDeviceToken: KeychainStore.read("deviceToken") != nil,
            isAutoDemoRequested: isAutoDemoRequested
        )
        guard shouldOpen else { return }

        DispatchQueue.main.async { [weak self] in
            self?.openActivation()
        }
    }

    private var isAutoDemoRequested: Bool {
        let processInfo = ProcessInfo.processInfo
        return processInfo.environment["CHACHING_AUTODEMO"] == "1" ||
            processInfo.arguments.contains("--chaching-autodemo")
    }

    private var shouldShowDemoControls: Bool {
        DemoControlsPolicy.shouldShowDemoControls(
            userDefaultsEnabled: UserDefaults.standard.bool(forKey: "ChaChing.showDemoControls")
        )
    }

    private var effectiveDemoMode: Bool {
        shouldShowDemoControls && settings.demoMode
    }

    private var canUseUserNotifications: Bool {
        Bundle.main.bundleURL.pathExtension == "app"
    }

    private func demoSummary() -> RevenueSummary {
        let events = DemoEventFactory.events()
        return RevenueSummary(
            todayRevenue: events.reduce(0) { $0 + $1.proceeds },
            todayEvents: events.count,
            biggestEvent: events.max(by: { $0.proceeds < $1.proceeds }),
            latestEvent: events.last,
            appBreakdown: [
                RevenueSummary.AppBreakdown(appName: "Orbit Tasks", revenue: 41.99, events: 1),
                RevenueSummary.AppBreakdown(appName: DemoCelebrationOptions.screenRecordingAppName, revenue: 13.99, events: 1)
            ],
            platformBreakdown: [
                RevenueSummary.PlatformBreakdown(platform: "iOS", revenue: 55.98, events: 2),
                RevenueSummary.PlatformBreakdown(platform: "Android", revenue: 13.99, events: 1)
            ],
            productBreakdown: [
                RevenueSummary.ProductBreakdown(productId: DemoCelebrationOptions.screenRecordingProductId, store: "APP_STORE", revenue: 13.99, events: 1),
                RevenueSummary.ProductBreakdown(productId: "orbit-tasks.yearly", store: "APP_STORE", revenue: 41.99, events: 1)
            ]
        )
    }

    private func emptySummary() -> RevenueSummary {
        RevenueSummary(
            todayRevenue: 0,
            todayEvents: 0,
            biggestEvent: nil,
            latestEvent: nil,
            appBreakdown: [],
            platformBreakdown: [],
            productBreakdown: []
        )
    }

    private func money(_ amount: Double) -> String {
        let number = NumberFormatter()
        number.numberStyle = .currency
        number.currencyCode = "USD"
        return number.string(from: NSNumber(value: amount)) ?? "$\(amount)"
    }
}
