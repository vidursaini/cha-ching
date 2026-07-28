import Foundation

public enum RevenueEventType: String, Codable, Equatable, Sendable {
    case initialPurchase = "initial_purchase"
    case renewal
    case nonRenewingPurchase = "non_renewing_purchase"
    case refund
    case cancellation
    case uncancellation
    case expiration
    case billingIssue = "billing_issue"
    case productChange = "product_change"
    case subscriptionPaused = "subscription_paused"
    case unknown
}

public struct RevenueEvent: Codable, Equatable, Identifiable, Sendable {
    public let id: Int
    public let sourceProvider: String
    public let sourceEventId: String
    public let eventType: RevenueEventType
    public let appName: String
    public let store: String?
    public let environment: String?
    public let productId: String?
    public let transactionId: String?
    public let transactionIdSuffix: String?
    public let amount: Double
    public let proceeds: Double
    public let currency: String
    public let countryCode: String?
    public let purchasedAt: Date?
    public let receivedAt: Date

    public init(
        id: Int,
        sourceProvider: String,
        sourceEventId: String,
        eventType: RevenueEventType,
        appName: String,
        store: String?,
        environment: String?,
        productId: String?,
        transactionId: String?,
        transactionIdSuffix: String?,
        amount: Double,
        proceeds: Double,
        currency: String,
        countryCode: String?,
        purchasedAt: Date?,
        receivedAt: Date
    ) {
        self.id = id
        self.sourceProvider = sourceProvider
        self.sourceEventId = sourceEventId
        self.eventType = eventType
        self.appName = appName
        self.store = store
        self.environment = environment
        self.productId = productId
        self.transactionId = transactionId
        self.transactionIdSuffix = transactionIdSuffix
        self.amount = amount
        self.proceeds = proceeds
        self.currency = currency
        self.countryCode = countryCode
        self.purchasedAt = purchasedAt
        self.receivedAt = receivedAt
    }
}

public struct EventsResponse: Codable, Equatable, Sendable {
    public let events: [RevenueEvent]
}

public struct SyncResponse: Codable, Equatable, Sendable {
    public let events: [RevenueEvent]
    public let summary: RevenueSummary
    public let serverTime: Date
    public let pollAfterSeconds: Double

    public init(events: [RevenueEvent], summary: RevenueSummary, serverTime: Date, pollAfterSeconds: Double) {
        self.events = events
        self.summary = summary
        self.serverTime = serverTime
        self.pollAfterSeconds = pollAfterSeconds
    }
}

public struct APIMetadata: Codable, Equatable, Sendable {
    public enum DeploymentMode: String, Codable, Equatable, Sendable {
        case hosted
        case selfHosted = "self_hosted"
    }

    public struct Capabilities: Codable, Equatable, Sendable {
        public let dodoLicensing: Bool
        public let selfHostActivation: Bool
        public let providers: [RevenueProvider]
        public let combinedSync: Bool
    }

    public let apiVersion: Int
    public let deploymentMode: DeploymentMode
    public let capabilities: Capabilities
}

public struct RevenueSummary: Codable, Equatable, Sendable {
    public struct AppBreakdown: Codable, Equatable, Sendable {
        public let appName: String
        public let revenue: Double
        public let events: Int

        public init(appName: String, revenue: Double, events: Int) {
            self.appName = appName
            self.revenue = revenue
            self.events = events
        }
    }

    public struct PlatformBreakdown: Codable, Equatable, Sendable {
        public let platform: String
        public let revenue: Double
        public let events: Int

        public init(platform: String, revenue: Double, events: Int) {
            self.platform = platform
            self.revenue = revenue
            self.events = events
        }
    }

    public struct ProductBreakdown: Codable, Equatable, Sendable {
        public let productId: String
        public let store: String?
        public let revenue: Double
        public let events: Int

        public init(productId: String, store: String?, revenue: Double, events: Int) {
            self.productId = productId
            self.store = store
            self.revenue = revenue
            self.events = events
        }
    }

    public let todayRevenue: Double
    public let todayEvents: Int
    public let biggestEvent: RevenueEvent?
    public let latestEvent: RevenueEvent?
    public let appBreakdown: [AppBreakdown]
    public let platformBreakdown: [PlatformBreakdown]
    public let productBreakdown: [ProductBreakdown]

    public init(
        todayRevenue: Double,
        todayEvents: Int,
        biggestEvent: RevenueEvent?,
        latestEvent: RevenueEvent?,
        appBreakdown: [AppBreakdown],
        platformBreakdown: [PlatformBreakdown] = [],
        productBreakdown: [ProductBreakdown] = []
    ) {
        self.todayRevenue = todayRevenue
        self.todayEvents = todayEvents
        self.biggestEvent = biggestEvent
        self.latestEvent = latestEvent
        self.appBreakdown = appBreakdown
        self.platformBreakdown = platformBreakdown
        self.productBreakdown = productBreakdown
    }

    private enum CodingKeys: String, CodingKey {
        case todayRevenue
        case todayEvents
        case biggestEvent
        case latestEvent
        case appBreakdown
        case platformBreakdown
        case productBreakdown
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        todayRevenue = try container.decode(Double.self, forKey: .todayRevenue)
        todayEvents = try container.decode(Int.self, forKey: .todayEvents)
        biggestEvent = try container.decodeIfPresent(RevenueEvent.self, forKey: .biggestEvent)
        latestEvent = try container.decodeIfPresent(RevenueEvent.self, forKey: .latestEvent)
        appBreakdown = try container.decodeIfPresent([AppBreakdown].self, forKey: .appBreakdown) ?? []
        platformBreakdown = try container.decodeIfPresent([PlatformBreakdown].self, forKey: .platformBreakdown) ?? []
        productBreakdown = try container.decodeIfPresent([ProductBreakdown].self, forKey: .productBreakdown) ?? []
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(todayRevenue, forKey: .todayRevenue)
        try container.encode(todayEvents, forKey: .todayEvents)
        try container.encodeIfPresent(biggestEvent, forKey: .biggestEvent)
        try container.encodeIfPresent(latestEvent, forKey: .latestEvent)
        try container.encode(appBreakdown, forKey: .appBreakdown)
        try container.encode(platformBreakdown, forKey: .platformBreakdown)
        try container.encode(productBreakdown, forKey: .productBreakdown)
    }
}

public enum RevenueProvider: String, Codable, Equatable, Sendable {
    case superwall
    case revenuecat
}

public struct ProviderConfigRequest: Codable, Equatable, Sendable {
    public let configId: String?
    public let provider: RevenueProvider
    public let enabled: Bool
    public let displayName: String?
    public let webhookSecret: String?
    public let authorizationHeader: String?

    public init(
        configId: String? = nil,
        provider: RevenueProvider,
        enabled: Bool = true,
        displayName: String? = nil,
        webhookSecret: String? = nil,
        authorizationHeader: String? = nil
    ) {
        self.configId = configId
        self.provider = provider
        self.enabled = enabled
        self.displayName = displayName
        self.webhookSecret = webhookSecret
        self.authorizationHeader = authorizationHeader
    }
}

public struct ProviderConfigSummary: Codable, Equatable, Sendable {
    public let id: String
    public let provider: RevenueProvider
    public let displayName: String?
    public let enabled: Bool
    public let keyHint: String?
    public let webhookURL: String
    public let updatedAt: Date

    public init(id: String, provider: RevenueProvider, displayName: String?, enabled: Bool, keyHint: String?, webhookURL: String, updatedAt: Date) {
        self.id = id
        self.provider = provider
        self.displayName = displayName
        self.enabled = enabled
        self.keyHint = keyHint
        self.webhookURL = webhookURL
        self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case provider
        case displayName
        case enabled
        case keyHint
        case webhookURL = "webhookUrl"
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        provider = try container.decode(RevenueProvider.self, forKey: .provider)
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName)
        enabled = try container.decode(Bool.self, forKey: .enabled)
        keyHint = try container.decodeIfPresent(String.self, forKey: .keyHint)
        webhookURL = try container.decode(String.self, forKey: .webhookURL)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? webhookURL
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(provider, forKey: .provider)
        try container.encodeIfPresent(displayName, forKey: .displayName)
        try container.encode(enabled, forKey: .enabled)
        try container.encodeIfPresent(keyHint, forKey: .keyHint)
        try container.encode(webhookURL, forKey: .webhookURL)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
}

public struct ProviderConfigResponse: Codable, Equatable, Sendable {
    public let config: ProviderConfigSummary
}

public struct ProviderConfigsResponse: Codable, Equatable, Sendable {
    public let configs: [ProviderConfigSummary]
}
