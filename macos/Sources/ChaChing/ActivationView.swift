import AppKit
import ChaChingCore
import SwiftUI

struct ActivationView: View {
    @State private var baseURL: String
    @State private var licenseKey: String
    @State private var setupToken = ""
    @State private var deviceToken: String?
    @State private var status = ""
    @State private var providerStatus = ""
    @State private var isActivating = false
    @State private var superwallConnections: [ProviderConnectionDraft] = [.blank(provider: .superwall)]
    @State private var revenueCatConnections: [ProviderConnectionDraft] = [.blank(provider: .revenuecat)]

    private let initialSettings: AppSettings
    private let runtime = AppRuntimeConfiguration.current
    private let onSave: (AppSettings, String?, Bool) -> Void

    init(settings: AppSettings, deviceToken: String?, onSave: @escaping (AppSettings, String?, Bool) -> Void) {
        self.initialSettings = settings
        self.onSave = onSave
        _baseURL = State(initialValue: settings.baseURLString)
        _licenseKey = State(initialValue: settings.licenseKey)
        _deviceToken = State(initialValue: deviceToken)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                licenseSection
                licenseStatusMessage
                providerSection
            }
            .padding(28)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .task { await loadExistingProviderConfigs() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Connect Cha-Ching")
                .font(.system(size: 30, weight: .bold))
            Text("Activate this Mac, then connect every app Cha-Ching should watch while your Mac is offline.")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var licenseSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(runtime.capabilities.requiresLicense ? "License" : "Self-hosted server")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)

            if runtime.capabilities.requiresLicense {
                SecureField("Dodo license key", text: $licenseKey)
                    .font(.system(size: 13))
                    .textFieldStyle(.roundedBorder)
            } else {
                TextField("https://your-worker.workers.dev", text: $baseURL)
                    .font(.system(size: 13))
                    .textFieldStyle(.roundedBorder)
                SecureField("Self-host setup token", text: $setupToken)
                    .font(.system(size: 13))
                    .textFieldStyle(.roundedBorder)
                Text("The setup token is used once and is not saved on this Mac.")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
            }

            HStack {
                if runtime.capabilities.requiresLicense {
                    Button("Save settings") {
                        saveSettings(closeWindow: false)
                        status = "Settings saved"
                    }
                }
                Spacer()
                Button(isActivating ? "Activating..." : activationButtonTitle) {
                    Task { await activate() }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!canActivate)
            }
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var providerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Revenue sources")
                    .font(.system(size: 18, weight: .bold))
                Text("Add one connection per app. Each app gets its own webhook URL and encrypted credentials.")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            superwallSection
            revenueCatSection
            providerStatusMessage
        }
    }

    private var superwallSection: some View {
        providerGroup(
            title: "Superwall",
            description: "Use this for every app where Superwall is your paywall and subscription event source.",
            steps: [
                "Click Generate URL for the specific app.",
                "In Superwall, open Integrations > Webhooks and add a webhook using that URL.",
                "Copy the signing secret Superwall shows for that webhook.",
                "Paste the signing secret here, save, then send a test webhook."
            ],
            addTitle: "Add another Superwall app",
            addAction: { superwallConnections.append(.blank(provider: .superwall)) }
        ) {
            ForEach($superwallConnections) { $draft in
                connectionCard(draft: $draft)
            }
        }
    }

    private var revenueCatSection: some View {
        providerGroup(
            title: "RevenueCat",
            description: "Use this for every app where RevenueCat is your source of subscription events.",
            steps: [
                "Click Generate URL for the specific app.",
                "In RevenueCat, open Project > Integrations > Webhooks > Add new configuration.",
                "Paste the URL, choose production or sandbox events, and set an Authorization header value.",
                "Paste the same Authorization header value here. Cha-Ching does not need your RevenueCat REST API key."
            ],
            addTitle: "Add another RevenueCat app",
            addAction: { revenueCatConnections.append(.blank(provider: .revenuecat)) }
        ) {
            ForEach($revenueCatConnections) { $draft in
                connectionCard(draft: $draft)
            }
        }
    }

    private func providerGroup<Content: View>(
        title: String,
        description: String,
        steps: [String],
        addTitle: String,
        addAction: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 16, weight: .bold))
                    Text(description)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
            }

            setupSteps(steps)
            content()

            Button(addTitle, action: addAction)
                .disabled(deviceToken == nil)
        }
        .padding(14)
        .background(Color.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func connectionCard(draft: Binding<ProviderConnectionDraft>) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 10) {
                Text(draft.wrappedValue.cardTitle)
                    .font(.system(size: 13, weight: .bold))
                if draft.wrappedValue.enabled {
                    Text("active")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.green)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.green.opacity(0.12), in: Capsule())
                }
                Spacer()
                if draft.wrappedValue.canRemove {
                    Button("Remove") {
                        removeDraft(draft.wrappedValue.id, provider: draft.wrappedValue.provider)
                    }
                    .font(.system(size: 11, weight: .medium))
                }
            }

            TextField("Public app name, e.g. Nimbus Notes", text: draft.displayName)
                .textFieldStyle(.roundedBorder)

            switch draft.wrappedValue.provider {
            case .superwall:
                SecureField(secretPlaceholder(for: draft.wrappedValue), text: draft.webhookSecret)
                    .textFieldStyle(.roundedBorder)
            case .revenuecat:
                SecureField(authorizationPlaceholder(for: draft.wrappedValue), text: draft.authorizationHeader)
                    .textFieldStyle(.roundedBorder)
            }

            webhookURLRow(draft.wrappedValue.webhookURL)

            HStack {
                if let disabledMessage = providerDisabledMessage {
                    Text(disabledMessage)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                } else if draft.wrappedValue.needsWebhookURL {
                    Text("Generate a URL before adding this app in \(draft.wrappedValue.provider.displayName).")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button(draft.wrappedValue.isGenerating ? "Generating..." : "Generate URL") {
                    Task { await generateURL(for: draft.wrappedValue.id, provider: draft.wrappedValue.provider) }
                }
                .disabled(deviceToken == nil || draft.wrappedValue.isGenerating || draft.wrappedValue.isSaving)

                Button(draft.wrappedValue.isSaving ? "Saving..." : "Save") {
                    Task { await saveConnection(for: draft.wrappedValue.id, provider: draft.wrappedValue.provider) }
                }
                .disabled(deviceToken == nil || draft.wrappedValue.isGenerating || draft.wrappedValue.isSaving)
            }
        }
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.72), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func setupSteps(_ steps: [String]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("Setup steps")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .top, spacing: 7) {
                    Text("\(index + 1).")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .frame(width: 18, alignment: .leading)
                    Text(step)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.72), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    @ViewBuilder
    private func webhookURLRow(_ value: String) -> some View {
        if !value.isEmpty {
            HStack(spacing: 8) {
                Text(value)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .textSelection(.enabled)
                Spacer()
                Button("Copy URL") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(value, forType: .string)
                    providerStatus = "Webhook URL copied"
                }
            }
            .padding(.top, 2)
        }
    }

    @ViewBuilder
    private var licenseStatusMessage: some View {
        if !status.isEmpty {
            Text(status)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(status.hasPrefix("Activation failed") || status.hasPrefix("Invalid") ? .red : .green)
                .padding(.horizontal, 2)
        }
    }

    @ViewBuilder
    private var providerStatusMessage: some View {
        if !providerStatus.isEmpty {
            Text(providerStatus)
            .font(.system(size: 12, weight: .medium))
                .foregroundStyle(providerStatus.hasPrefix("Failed") ? .red : .green)
                .padding(.horizontal, 2)
        }
    }

    private var activationButtonTitle: String {
        if runtime.capabilities.requiresLicense {
            return deviceToken == nil ? "Activate Mac" : "Refresh activation"
        }
        return deviceToken == nil ? "Connect Server" : "Reconnect Server"
    }

    private var canActivate: Bool {
        guard !isActivating, !baseURL.isEmpty else { return false }
        return runtime.capabilities.requiresLicense ? !licenseKey.isEmpty : !setupToken.isEmpty
    }

    private var providerDisabledMessage: String? {
        deviceToken == nil ? "Activate this Mac first." : nil
    }

    private func saveSettings(closeWindow: Bool) {
        var updated = initialSettings
        updated.baseURLString = baseURL
        updated.licenseKey = licenseKey
        onSave(updated, nil, closeWindow)
    }

    private func activate() async {
        guard let url = BackendURLValidator.validatedURL(baseURL) else {
            status = "Invalid backend URL. Use HTTPS, except for localhost development."
            return
        }

        isActivating = true
        defer { isActivating = false }

        do {
            let client = APIClient(baseURL: url)
            if runtime.distribution == .community {
                let metadata = try await client.fetchMetadata()
                guard metadata.apiVersion == 1, metadata.deploymentMode == .selfHosted else {
                    status = "This server is not compatible with Cha-Ching Community."
                    return
                }
            }

            let deviceName = Host.current().localizedName ?? "Mac"
            let token = runtime.capabilities.requiresLicense
                ? try await client.activate(licenseKey: licenseKey, deviceName: deviceName)
                : try await client.activateSelfHosted(setupToken: setupToken, deviceName: deviceName)
            deviceToken = token
            setupToken = ""
            var updated = initialSettings
            updated.baseURLString = baseURL
            updated.licenseKey = licenseKey
            status = "Activated. Add your apps below."
            onSave(updated, token, false)
            await loadExistingProviderConfigs()
        } catch {
            status = "Activation failed: \(error.localizedDescription)"
        }
    }

    private func generateURL(for id: ProviderConnectionDraft.ID, provider: RevenueProvider) async {
        guard let deviceToken, let client = makeClient(), let current = draft(id, provider: provider) else { return }
        setDraftLoading(id, provider: provider, generating: true)
        defer { setDraftLoading(id, provider: provider, generating: false) }

        do {
            let config = try await client.saveProviderConfig(
                deviceToken: deviceToken,
                request: requestBody(for: current, enabled: false)
            )
            apply(config, to: id, provider: provider)
            providerStatus = "\(provider.displayName) URL generated for \(current.statusName). Add it in \(provider.displayName), then save the credential here."
        } catch {
            providerStatus = "Failed to generate \(provider.displayName) URL: \(error.localizedDescription)"
        }
    }

    private func saveConnection(for id: ProviderConnectionDraft.ID, provider: RevenueProvider) async {
        guard let deviceToken, let client = makeClient(), let current = draft(id, provider: provider) else { return }
        setDraftLoading(id, provider: provider, saving: true)
        defer { setDraftLoading(id, provider: provider, saving: false) }

        do {
            let config = try await client.saveProviderConfig(
                deviceToken: deviceToken,
                request: requestBody(for: current, enabled: true)
            )
            apply(config, to: id, provider: provider)
            providerStatus = "\(provider.displayName) saved for \(current.statusName)."
        } catch {
            providerStatus = "Failed to save \(provider.displayName): \(error.localizedDescription)"
        }
    }

    private func requestBody(for draft: ProviderConnectionDraft, enabled: Bool) -> ProviderConfigRequest {
        switch draft.provider {
        case .superwall:
            ProviderConfigRequest(
                configId: draft.configID,
                provider: .superwall,
                enabled: enabled,
                displayName: emptyToNil(draft.displayName),
                webhookSecret: emptyToNil(draft.webhookSecret)
            )
        case .revenuecat:
            ProviderConfigRequest(
                configId: draft.configID,
                provider: .revenuecat,
                enabled: enabled,
                displayName: emptyToNil(draft.displayName),
                authorizationHeader: emptyToNil(draft.authorizationHeader)
            )
        }
    }

    private func loadExistingProviderConfigs() async {
        guard let deviceToken, let client = makeClient() else { return }
        do {
            let configs = try await client.fetchProviderConfigs(deviceToken: deviceToken)
            let superwall = configs.filter { $0.provider == .superwall }.map(ProviderConnectionDraft.init(summary:))
            let revenueCat = configs.filter { $0.provider == .revenuecat }.map(ProviderConnectionDraft.init(summary:))
            if !superwall.isEmpty { superwallConnections = superwall }
            if !revenueCat.isEmpty { revenueCatConnections = revenueCat }
        } catch {
            providerStatus = "Failed to load source setup: \(error.localizedDescription)"
        }
    }

    private func draft(_ id: ProviderConnectionDraft.ID, provider: RevenueProvider) -> ProviderConnectionDraft? {
        switch provider {
        case .superwall:
            superwallConnections.first { $0.id == id }
        case .revenuecat:
            revenueCatConnections.first { $0.id == id }
        }
    }

    private func apply(_ config: ProviderConfigSummary, to id: ProviderConnectionDraft.ID, provider: RevenueProvider) {
        updateDraft(id, provider: provider) { draft in
            draft.configID = config.id
            draft.webhookURL = config.webhookURL
            draft.keyHint = config.keyHint
            draft.enabled = config.enabled
            if let displayName = config.displayName {
                draft.displayName = displayName
            }
        }
    }

    private func setDraftLoading(
        _ id: ProviderConnectionDraft.ID,
        provider: RevenueProvider,
        generating: Bool? = nil,
        saving: Bool? = nil
    ) {
        updateDraft(id, provider: provider) { draft in
            if let generating { draft.isGenerating = generating }
            if let saving { draft.isSaving = saving }
        }
    }

    private func updateDraft(
        _ id: ProviderConnectionDraft.ID,
        provider: RevenueProvider,
        mutate: (inout ProviderConnectionDraft) -> Void
    ) {
        switch provider {
        case .superwall:
            guard let index = superwallConnections.firstIndex(where: { $0.id == id }) else { return }
            mutate(&superwallConnections[index])
        case .revenuecat:
            guard let index = revenueCatConnections.firstIndex(where: { $0.id == id }) else { return }
            mutate(&revenueCatConnections[index])
        }
    }

    private func removeDraft(_ id: ProviderConnectionDraft.ID, provider: RevenueProvider) {
        switch provider {
        case .superwall:
            guard superwallConnections.count > 1 else { return }
            superwallConnections.removeAll { $0.id == id }
        case .revenuecat:
            guard revenueCatConnections.count > 1 else { return }
            revenueCatConnections.removeAll { $0.id == id }
        }
    }

    private func secretPlaceholder(for draft: ProviderConnectionDraft) -> String {
        if let keyHint = draft.keyHint {
            return "Superwall webhook signing secret (\(keyHint))"
        }
        return "Superwall webhook signing secret"
    }

    private func authorizationPlaceholder(for draft: ProviderConnectionDraft) -> String {
        if let keyHint = draft.keyHint {
            return "RevenueCat Authorization header value (\(keyHint))"
        }
        return "RevenueCat Authorization header value"
    }

    private func makeClient() -> APIClient? {
        guard let url = URL(string: baseURL) else { return nil }
        return APIClient(baseURL: url)
    }

    private func emptyToNil(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

private struct ProviderConnectionDraft: Identifiable, Equatable {
    let id: UUID
    let provider: RevenueProvider
    var configID: String?
    var displayName: String
    var webhookSecret: String
    var authorizationHeader: String
    var webhookURL: String
    var keyHint: String?
    var enabled: Bool
    var isGenerating: Bool
    var isSaving: Bool

    static func blank(provider: RevenueProvider) -> ProviderConnectionDraft {
        ProviderConnectionDraft(
            id: UUID(),
            provider: provider,
            configID: nil,
            displayName: "",
            webhookSecret: "",
            authorizationHeader: "",
            webhookURL: "",
            keyHint: nil,
            enabled: false,
            isGenerating: false,
            isSaving: false
        )
    }

    init(summary: ProviderConfigSummary) {
        id = UUID()
        provider = summary.provider
        configID = summary.id
        displayName = summary.displayName ?? ""
        webhookSecret = ""
        authorizationHeader = ""
        webhookURL = summary.webhookURL
        keyHint = summary.keyHint
        enabled = summary.enabled
        isGenerating = false
        isSaving = false
    }

    private init(
        id: UUID,
        provider: RevenueProvider,
        configID: String?,
        displayName: String,
        webhookSecret: String,
        authorizationHeader: String,
        webhookURL: String,
        keyHint: String?,
        enabled: Bool,
        isGenerating: Bool,
        isSaving: Bool
    ) {
        self.id = id
        self.provider = provider
        self.configID = configID
        self.displayName = displayName
        self.webhookSecret = webhookSecret
        self.authorizationHeader = authorizationHeader
        self.webhookURL = webhookURL
        self.keyHint = keyHint
        self.enabled = enabled
        self.isGenerating = isGenerating
        self.isSaving = isSaving
    }

    var canRemove: Bool {
        configID == nil && webhookURL.isEmpty
    }

    var needsWebhookURL: Bool {
        webhookURL.isEmpty
    }

    var cardTitle: String {
        statusName
    }

    var statusName: String {
        let trimmed = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "New \(provider.displayName) app" : trimmed
    }
}

private extension RevenueProvider {
    var displayName: String {
        switch self {
        case .superwall:
            "Superwall"
        case .revenuecat:
            "RevenueCat"
        }
    }
}
