import Foundation

public struct RevenueEventFormatter: Sendable {
    private let currencyFormatter: NumberFormatter

    public init(locale: Locale = .current) {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = locale
        formatter.maximumFractionDigits = 2
        self.currencyFormatter = formatter
    }

    public func title(for event: RevenueEvent) -> String {
        switch event.eventType {
        case .initialPurchase:
            return "New purchase in \(event.appName)"
        case .renewal:
            return "\(event.appName) renewed"
        case .nonRenewingPurchase:
            return "One-time sale in \(event.appName)"
        case .refund:
            return "Refund in \(event.appName)"
        case .cancellation:
            return "\(event.appName) cancellation"
        case .uncancellation:
            return "\(event.appName) reactivated"
        case .expiration:
            return "\(event.appName) expired"
        case .billingIssue:
            return "\(event.appName) billing issue"
        case .productChange:
            return "\(event.appName) product changed"
        case .subscriptionPaused:
            return "\(event.appName) paused"
        case .unknown:
            return "Revenue event in \(event.appName)"
        }
    }

    public func amount(_ event: RevenueEvent) -> String {
        currencyFormatter.currencyCode = event.currency
        return currencyFormatter.string(from: NSNumber(value: event.proceeds)) ?? "\(event.currency) \(event.proceeds)"
    }

    public func notificationBody(for event: RevenueEvent) -> String {
        let suffix = event.transactionIdSuffix.map { "txn ...\($0)" } ?? "no txn id"
        return "\(event.eventDisplayName) - \(amountLine(for: event)) - \(event.productId ?? "unknown product") - \(event.storeCountryLabel) - \(suffix)"
    }

    public func spokenLine(for event: RevenueEvent) -> String {
        "\(title(for: event)). \(amount(event)) net."
    }

    public func amountLine(for event: RevenueEvent) -> String {
        switch event.eventType {
        case .renewal:
            return "\(amount(event)) subscription renewed from \(event.countryName)"
        case .initialPurchase:
            return "\(amount(event)) new purchase from \(event.countryName)"
        case .nonRenewingPurchase:
            return "\(amount(event)) one-time purchase from \(event.countryName)"
        default:
            return "\(amount(event)) from \(event.countryName)"
        }
    }
}

public extension RevenueEvent {
    var storeLabel: String {
        switch store {
        case "APP_STORE": return "App Store"
        case "PLAY_STORE": return "Play Store"
        case "STRIPE": return "Stripe"
        case let value?: return value
        case nil: return "Unknown store"
        }
    }

    var platformLabel: String {
        switch store {
        case "APP_STORE": return "iOS"
        case "PLAY_STORE": return "Android"
        case "STRIPE": return "Web"
        case let value?: return value
        case nil: return "Unknown"
        }
    }

    var countryName: String {
        guard let countryCode,
              let name = Locale(identifier: "en_US").localizedString(forRegionCode: countryCode)
        else { return "unknown country" }
        return name
    }

    var storeCountryLabel: String {
        "\(storeLabel) - \(countryName)"
    }

    var eventDisplayName: String {
        switch eventType {
        case .initialPurchase: return "New purchase"
        case .renewal: return "Renewal"
        case .nonRenewingPurchase: return "One-time sale"
        case .refund: return "Refund"
        case .cancellation: return "Cancellation"
        case .uncancellation: return "Reactivated"
        case .expiration: return "Expired"
        case .billingIssue: return "Billing issue"
        case .productChange: return "Product changed"
        case .subscriptionPaused: return "Paused"
        case .unknown: return "Revenue event"
        }
    }

    var isCelebratory: Bool {
        proceeds > 0 && [.initialPurchase, .renewal, .nonRenewingPurchase].contains(eventType)
    }
}
