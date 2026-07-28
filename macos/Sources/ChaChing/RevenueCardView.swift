import ChaChingCore
import SwiftUI

struct RevenueCardView: View {
    let summary: RevenueSummary
    private let formatter = RevenueEventFormatter()

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("CHA-CHING REPORT")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.green)
                    Text("Today")
                        .font(.system(size: 42, weight: .bold))
                }
                Spacer()
                Text(money(summary.todayRevenue))
                    .font(.system(size: 46, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(.green)
            }

            HStack(spacing: 14) {
                metric("events", "\(summary.todayEvents)")
                metric("biggest", summary.biggestEvent.map { formatter.amount($0) } ?? "$0")
                platformMetric()
            }

            VStack(alignment: .leading, spacing: 12) {
                Text("app breakdown")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.secondary)
                ForEach(summary.appBreakdown, id: \.appName) { app in
                    HStack {
                        Text(app.appName)
                            .font(.system(size: 18, weight: .semibold))
                        Spacer()
                        Text("\(app.events)x")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(.secondary)
                        Text(money(app.revenue))
                            .font(.system(size: 18, weight: .semibold))
                            .monospacedDigit()
                    }
                    ProgressView(value: max(app.revenue, 0), total: max(summary.todayRevenue, 1))
                        .tint(.green)
                }
            }

            VStack(alignment: .leading, spacing: 12) {
                Text("product breakdown")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.secondary)
                if summary.productBreakdown.isEmpty {
                    Text("waiting for product data")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(summary.productBreakdown, id: \.key) { product in
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(product.productId)
                                    .font(.system(size: 16, weight: .semibold))
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                                Text("\(product.platformLabel) - \(product.storeLabel)")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("\(product.events)x")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(.secondary)
                            Text(money(product.revenue))
                                .font(.system(size: 16, weight: .semibold))
                                .monospacedDigit()
                        }
                    }
                }
            }

            if let latest = summary.latestEvent {
                VStack(alignment: .leading, spacing: 8) {
                    Text("latest")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.secondary)
                    latestEventDetails(latest)
                }
            }

            Button("Copy share summary") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(shareText, forType: .string)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(30)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var shareText: String {
        """
        CHA-CHING REPORT
        today revenue: \(money(summary.todayRevenue))
        events: \(summary.todayEvents)
        biggest: \(summary.biggestEvent.map { formatter.amount($0) } ?? "$0")
        iOS: \(money(platformRevenue("iOS")))
        Android: \(money(platformRevenue("Android")))
        """
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 22, weight: .semibold))
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func platformMetric() -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("platforms")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
            HStack {
                platformAmount("iOS", platform: "iOS")
                Spacer(minLength: 8)
                platformAmount("Android", platform: "Android")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func platformAmount(_ label: String, platform: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            Text(money(platformRevenue(platform)))
                .font(.system(size: 16, weight: .semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }

    private func latestEventDetails(_ event: RevenueEvent) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(event.eventDisplayName)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(.blue)
            Text(formatter.amountLine(for: event))
                .font(.system(size: 17, weight: .regular))
            detailRow("Product", event.productId ?? "unknown product")
            detailRow("Store", event.storeCountryLabel)
            detailRow("Proceeds", formatter.amount(event))
            if let suffix = event.transactionIdSuffix {
                detailRow("Transaction", "txn ...\(suffix)")
            }
        }
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
            Text(value)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }

    private func platformRevenue(_ platform: String) -> Double {
        summary.platformBreakdown.first { $0.platform == platform }?.revenue ?? 0
    }

    private func money(_ amount: Double) -> String {
        let number = NumberFormatter()
        number.numberStyle = .currency
        number.currencyCode = "USD"
        return number.string(from: NSNumber(value: amount)) ?? "$\(amount)"
    }
}

private extension RevenueSummary.ProductBreakdown {
    var key: String {
        "\(store ?? "unknown"):\(productId)"
    }

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
}
