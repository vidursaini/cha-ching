import AppKit
import ChaChingCore
import QuartzCore
import SwiftUI

struct CelebrationEffectsView: View {
    let muted: Bool
    @State private var showEffects = true

    var body: some View {
        ConfettiCannonView()
            .ignoresSafeArea()
            .allowsHitTesting(false)
            .opacity(showEffects ? 1 : 0)
        .onAppear {
            if !muted {
                CelebrationSoundPlayer.playConfettiPop()
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.45) {
                withAnimation(.easeOut(duration: 0.42)) {
                    showEffects = false
                }
            }
        }
    }
}

struct RevenueNotificationToast: View {
    let event: RevenueEvent
    let formatter: RevenueEventFormatter
    let onOpenRevenueCard: () -> Void
    let onDismiss: () -> Void
    @State private var isVisible = false

    var body: some View {
        ZStack(alignment: .topLeading) {
            toastSurface
                .padding(.top, 8)
                .padding(.leading, 8)
            closeButton
                .zIndex(2)
        }
        .background(Color.clear)
        .offset(x: isVisible ? 0 : 34, y: isVisible ? 0 : -18)
        .scaleEffect(isVisible ? 1 : 0.96, anchor: .topTrailing)
        .opacity(isVisible ? 1 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.38, dampingFraction: 0.82)) {
                isVisible = true
            }
        }
    }

    private var toastSurface: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 10) {
                ChaChingToastIcon()
                    .frame(width: 34, height: 34)
                    .background(
                        Circle()
                            .fill(Color.white.opacity(0.09))
                    )
                    .overlay(
                        Circle()
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )

                HStack(spacing: 7) {
                    Text("Cha-Ching")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.92))

                    Circle()
                        .fill(Color(red: 0.46, green: 0.96, blue: 0.54))
                        .frame(width: 5, height: 5)

                    Text(event.eventDisplayName)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.90))
                        .lineLimit(1)
                }

                Spacer(minLength: 10)

                Text("just now")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.50))
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(formatter.amount(event))
                    .font(.system(size: 30, weight: .heavy, design: .default))
                    .minimumScaleFactor(0.76)
                    .lineLimit(1)
                    .foregroundStyle(Color.white.opacity(0.96))

                Text(formatter.title(for: event))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.92))
                    .lineLimit(1)
                    .truncationMode(.tail)
            }

            Text(metadataLine)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.62))
                .lineLimit(1)
                .truncationMode(.tail)

            HStack(alignment: .center, spacing: 10) {
                Text(productLine)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.48))
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .layoutPriority(1)

                Spacer(minLength: 6)

                Button(action: onOpenRevenueCard) {
                    HStack(spacing: 5) {
                        Image(systemName: "rectangle.on.rectangle")
                            .font(.system(size: 10.5, weight: .semibold))
                        Text("Revenue Card")
                            .font(.system(size: 11.5, weight: .semibold))
                    }
                    .foregroundStyle(Color.white.opacity(0.90))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.08), in: Capsule())
                    .overlay(
                        Capsule()
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .help("Open Revenue Card")
                .fixedSize()
            }
        }
        .padding(.top, 10)
        .padding(.leading, 16)
        .padding(.trailing, 14)
        .padding(.bottom, 10)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color(red: 0.055, green: 0.085, blue: 0.065))

                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.075, green: 0.16, blue: 0.105).opacity(0.94),
                                Color(red: 0.070, green: 0.085, blue: 0.060).opacity(0.98)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .opacity(0.10)
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.18),
                            Color(red: 0.48, green: 0.95, blue: 0.54).opacity(0.28),
                            Color.white.opacity(0.07)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .overlay(alignment: .leading) {
            Capsule()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.45, green: 0.95, blue: 0.50),
                            Color(red: 0.95, green: 0.74, blue: 0.25)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 4)
                .padding(.vertical, 18)
                .padding(.leading, 1.5)
        }
    }

    private var closeButton: some View {
        Button(action: onDismiss) {
            ZStack {
                Circle()
                    .fill(Color(red: 0.13, green: 0.16, blue: 0.14))
                    .frame(width: 24, height: 24)
                    .overlay(
                        Circle()
                            .stroke(Color.white.opacity(0.22), lineWidth: 1)
                    )

                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Color.white)
            }
            .frame(width: 28, height: 28)
            .compositingGroup()
            .contentShape(Circle())
            .accessibilityLabel("Dismiss notification")
        }
        .buttonStyle(.plain)
        .help("Dismiss")
    }

    private var metadataLine: String {
        metadataValues.joined(separator: "  -  ")
    }

    private var metadataValues: [String] {
        var rawValues = [providerLabel, event.platformLabel]
        if event.countryName != "unknown country" {
            rawValues.append(event.countryName)
        }
        if let environment = event.environment, !environment.isEmpty {
            rawValues.append(environment.capitalized)
        }

        var seen = Set<String>()
        return rawValues.compactMap { value in
            let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty else { return nil }
            let key = normalized.lowercased()
            guard !seen.contains(key) else { return nil }
            seen.insert(key)
            return normalized
        }
        .prefix(4)
        .map { $0 }
    }

    private var productLine: String {
        [
            event.productId ?? "unknown product",
            event.storeLabel,
            event.transactionIdSuffix.map { "txn ...\($0)" } ?? "no txn id"
        ]
        .compactMap { $0 }
        .joined(separator: "  -  ")
    }

    private var providerLabel: String {
        switch event.sourceProvider.lowercased() {
        case "superwall":
            return "Superwall"
        case "revenuecat":
            return "RevenueCat"
        case "stripe":
            return "Stripe"
        case "dodo":
            return "Dodo"
        case let value where !value.isEmpty:
            return value.capitalized
        default:
            return "Webhook"
        }
    }
}

private struct ChaChingToastIcon: View {
    private static let logoImage: NSImage? = {
        let fileNames = ["cha-logo-transparent", "cha-logo"]
        let candidates = fileNames.flatMap { fileName in
            [
                Bundle.module.url(forResource: fileName, withExtension: "png"),
                Bundle.module.url(forResource: fileName, withExtension: "png", subdirectory: "Logo"),
                Bundle.main.url(forResource: fileName, withExtension: "png"),
                Bundle.main.resourceURL?.appendingPathComponent("ChaChing_ChaChing.bundle/\(fileName).png"),
            ]
        }

        for url in candidates {
            if let url, let image = NSImage(contentsOf: url) {
                return image
            }
        }

        return nil
    }()

    var body: some View {
        Group {
            if let image = Self.logoImage {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
                    .padding(1)
            } else {
                fallbackIcon
            }
        }
        .frame(width: 42, height: 42)
    }

    private var fallbackIcon: some View {
        Image(systemName: "bell.badge.fill")
            .font(.system(size: 28, weight: .black))
            .foregroundStyle(Color(red: 0.08, green: 0.72, blue: 0.22))
            .frame(width: 42, height: 42)
    }
}

private struct ConfettiCannonView: NSViewRepresentable {
    func makeNSView(context: Context) -> ConfettiCannonNSView {
        ConfettiCannonNSView()
    }

    func updateNSView(_ nsView: ConfettiCannonNSView, context: Context) {}
}

private final class ConfettiCannonNSView: NSView {
    private let cannonEmitter = CAEmitterLayer()
    private let sparkleEmitter = CAEmitterLayer()
    private var didBurst = false
    private var displayScale: CGFloat = 1

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.masksToBounds = false
        layer?.drawsAsynchronously = true
        layer?.addSublayer(cannonEmitter)
        layer?.addSublayer(sparkleEmitter)
    }

    required init?(coder: NSCoder) {
        nil
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        needsLayout = true
    }

    override func layout() {
        super.layout()
        guard window != nil else { return }
        configureEmitterFrames()
        if !didBurst, bounds.width > 0, bounds.height > 0 {
            didBurst = true
            startCannon()
        }
    }

    private func configureEmitterFrames() {
        displayScale = max(1, window?.backingScaleFactor ?? window?.screen?.backingScaleFactor ?? NSScreen.main?.backingScaleFactor ?? 2)
        layer?.contentsScale = displayScale
        let origin = CGPoint(x: bounds.maxX - 42, y: bounds.maxY - 104)
        for emitter in [cannonEmitter, sparkleEmitter] {
            emitter.frame = bounds
            emitter.contentsScale = displayScale
            emitter.drawsAsynchronously = true
            emitter.emitterPosition = origin
            emitter.emitterShape = .point
            emitter.renderMode = .unordered
        }
    }

    private func startCannon() {
        cannonEmitter.birthRate = 1
        cannonEmitter.emitterCells = [
            makeConfettiCell(color: .systemGreen, width: 28, height: 10, birthRate: 95, velocity: 1180),
            makeConfettiCell(color: .systemYellow, width: 20, height: 8, birthRate: 90, velocity: 1080),
            makeConfettiCell(color: .systemOrange, width: 22, height: 8, birthRate: 82, velocity: 1120),
            makeConfettiCell(color: .white, width: 18, height: 7, birthRate: 72, velocity: 1040),
            makeConfettiCell(color: .systemMint, width: 16, height: 20, birthRate: 72, velocity: 1140),
            makeBillCell(birthRate: 28, velocity: 980),
            makeCoinCell(birthRate: 42, velocity: 1060, size: 18),
            makeCoinCell(birthRate: 26, velocity: 900, size: 24)
        ]

        sparkleEmitter.birthRate = 1
        sparkleEmitter.emitterCells = [
            makeSparkCell(color: .systemYellow, birthRate: 70, velocity: 760),
            makeSparkCell(color: .white, birthRate: 54, velocity: 700)
        ]

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.70) { [weak self] in
            self?.cannonEmitter.birthRate = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.42) { [weak self] in
            self?.sparkleEmitter.birthRate = 0
        }
    }

    private func makeConfettiCell(color: NSColor, width: CGFloat, height: CGFloat, birthRate: Float, velocity: CGFloat) -> CAEmitterCell {
        let cell = CAEmitterCell()
        cell.contents = confettiImage(size: CGSize(width: width, height: height), scale: displayScale)
        cell.contentsScale = displayScale
        cell.color = color.cgColor
        cell.birthRate = birthRate
        cell.lifetime = 2.35
        cell.lifetimeRange = 0.35
        cell.velocity = velocity
        cell.velocityRange = 260
        cell.emissionLongitude = .pi * 1.05
        cell.emissionRange = .pi * 0.23
        cell.spin = 9
        cell.spinRange = 15
        cell.scale = 0.92
        cell.scaleRange = 0.48
        cell.alphaSpeed = -0.52
        cell.xAcceleration = -110
        cell.yAcceleration = -410
        return cell
    }

    private func makeBillCell(birthRate: Float, velocity: CGFloat) -> CAEmitterCell {
        let cell = CAEmitterCell()
        cell.contents = billImage(size: CGSize(width: 44, height: 22), scale: displayScale)
        cell.contentsScale = displayScale
        cell.birthRate = birthRate
        cell.lifetime = 2.55
        cell.lifetimeRange = 0.30
        cell.velocity = velocity
        cell.velocityRange = 180
        cell.emissionLongitude = .pi * 1.04
        cell.emissionRange = .pi * 0.18
        cell.spin = 4.5
        cell.spinRange = 8
        cell.scale = 0.88
        cell.scaleRange = 0.28
        cell.alphaSpeed = -0.42
        cell.xAcceleration = -80
        cell.yAcceleration = -360
        return cell
    }

    private func makeCoinCell(birthRate: Float, velocity: CGFloat, size: CGFloat) -> CAEmitterCell {
        let cell = CAEmitterCell()
        cell.contents = coinImage(size: CGSize(width: size, height: size), scale: displayScale)
        cell.contentsScale = displayScale
        cell.birthRate = birthRate
        cell.lifetime = 2.45
        cell.lifetimeRange = 0.35
        cell.velocity = velocity
        cell.velocityRange = 190
        cell.emissionLongitude = .pi * 1.03
        cell.emissionRange = .pi * 0.22
        cell.spin = 10
        cell.spinRange = 16
        cell.scale = 0.94
        cell.scaleRange = 0.30
        cell.alphaSpeed = -0.46
        cell.xAcceleration = -95
        cell.yAcceleration = -390
        return cell
    }

    private func makeSparkCell(color: NSColor, birthRate: Float, velocity: CGFloat) -> CAEmitterCell {
        let cell = CAEmitterCell()
        cell.contents = sparkleImage(size: CGSize(width: 10, height: 10), scale: displayScale)
        cell.contentsScale = displayScale
        cell.color = color.cgColor
        cell.birthRate = birthRate
        cell.lifetime = 1.10
        cell.lifetimeRange = 0.30
        cell.velocity = velocity
        cell.velocityRange = 210
        cell.emissionLongitude = .pi * 1.02
        cell.emissionRange = .pi * 0.35
        cell.scale = 0.85
        cell.scaleRange = 0.45
        cell.alphaSpeed = -0.95
        cell.xAcceleration = -50
        cell.yAcceleration = -240
        return cell
    }

    private func confettiImage(size: CGSize, scale: CGFloat) -> CGImage? {
        let width = max(1, Int(ceil(size.width * scale)))
        let height = max(1, Int(ceil(size.height * scale)))
        let bytesPerRow = width * 4
        var pixels = [UInt8](repeating: 255, count: width * height * 4)
        return pixels.withUnsafeMutableBytes { buffer in
            guard let context = CGContext(
                data: buffer.baseAddress,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: bytesPerRow,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return nil }
            return context.makeImage()
        }
    }

    private func sparkleImage(size: CGSize, scale: CGFloat) -> CGImage? {
        let pixelSize = CGSize(width: size.width * scale, height: size.height * scale)
        let image = NSImage(size: pixelSize)
        image.lockFocus()
        NSColor.white.setFill()
        let path = NSBezierPath()
        path.move(to: NSPoint(x: pixelSize.width / 2, y: pixelSize.height))
        path.line(to: NSPoint(x: pixelSize.width * 0.64, y: pixelSize.height * 0.64))
        path.line(to: NSPoint(x: pixelSize.width, y: pixelSize.height / 2))
        path.line(to: NSPoint(x: pixelSize.width * 0.64, y: pixelSize.height * 0.36))
        path.line(to: NSPoint(x: pixelSize.width / 2, y: 0))
        path.line(to: NSPoint(x: pixelSize.width * 0.36, y: pixelSize.height * 0.36))
        path.line(to: NSPoint(x: 0, y: pixelSize.height / 2))
        path.line(to: NSPoint(x: pixelSize.width * 0.36, y: pixelSize.height * 0.64))
        path.close()
        path.fill()
        image.unlockFocus()
        var rect = NSRect(origin: .zero, size: pixelSize)
        return image.cgImage(forProposedRect: &rect, context: nil, hints: nil)
    }

    private func billImage(size: CGSize, scale: CGFloat) -> CGImage? {
        let pixelSize = CGSize(width: size.width * scale, height: size.height * scale)
        let image = NSImage(size: pixelSize)
        image.lockFocus()
        let rect = NSRect(origin: .zero, size: pixelSize)
        NSColor(calibratedRed: 0.77, green: 1.00, blue: 0.45, alpha: 1).setFill()
        NSBezierPath(roundedRect: rect, xRadius: 5 * scale, yRadius: 5 * scale).fill()
        NSColor(calibratedRed: 0.04, green: 0.28, blue: 0.10, alpha: 1).setStroke()
        let border = NSBezierPath(
            roundedRect: rect.insetBy(dx: 4 * scale, dy: 4 * scale),
            xRadius: 4 * scale,
            yRadius: 4 * scale
        )
        border.lineWidth = 1.5 * scale
        border.stroke()

        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 14 * scale, weight: .black),
            .foregroundColor: NSColor(calibratedRed: 0.04, green: 0.28, blue: 0.10, alpha: 1)
        ]
        let text = "$" as NSString
        let textSize = text.size(withAttributes: attributes)
        text.draw(
            at: NSPoint(x: (pixelSize.width - textSize.width) / 2, y: (pixelSize.height - textSize.height) / 2),
            withAttributes: attributes
        )

        image.unlockFocus()
        var proposed = rect
        return image.cgImage(forProposedRect: &proposed, context: nil, hints: nil)
    }

    private func coinImage(size: CGSize, scale: CGFloat) -> CGImage? {
        let pixelSize = CGSize(width: size.width * scale, height: size.height * scale)
        let image = NSImage(size: pixelSize)
        image.lockFocus()

        let rect = NSRect(origin: .zero, size: pixelSize)
        let outer = NSBezierPath(ovalIn: rect.insetBy(dx: 1 * scale, dy: 1 * scale))
        NSColor(calibratedRed: 1.00, green: 0.76, blue: 0.12, alpha: 1).setFill()
        outer.fill()

        let inner = NSBezierPath(ovalIn: rect.insetBy(dx: 4 * scale, dy: 4 * scale))
        NSColor(calibratedRed: 1.00, green: 0.90, blue: 0.34, alpha: 1).setFill()
        inner.fill()

        NSColor(calibratedRed: 0.78, green: 0.47, blue: 0.03, alpha: 1).setStroke()
        outer.lineWidth = 1.4 * scale
        outer.stroke()

        let shine = NSBezierPath()
        shine.lineWidth = max(1, 1.8 * scale)
        shine.lineCapStyle = .round
        NSColor.white.withAlphaComponent(0.65).setStroke()
        shine.move(to: NSPoint(x: pixelSize.width * 0.34, y: pixelSize.height * 0.68))
        shine.curve(
            to: NSPoint(x: pixelSize.width * 0.55, y: pixelSize.height * 0.82),
            controlPoint1: NSPoint(x: pixelSize.width * 0.40, y: pixelSize.height * 0.78),
            controlPoint2: NSPoint(x: pixelSize.width * 0.48, y: pixelSize.height * 0.82)
        )
        shine.stroke()

        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: size.width * 0.48 * scale, weight: .black),
            .foregroundColor: NSColor(calibratedRed: 0.52, green: 0.30, blue: 0.02, alpha: 1)
        ]
        let text = "$" as NSString
        let textSize = text.size(withAttributes: attributes)
        text.draw(
            at: NSPoint(x: (pixelSize.width - textSize.width) / 2, y: (pixelSize.height - textSize.height) / 2),
            withAttributes: attributes
        )

        image.unlockFocus()
        var proposed = rect
        return image.cgImage(forProposedRect: &proposed, context: nil, hints: nil)
    }
}

@MainActor
private enum CelebrationSoundPlayer {
    private static var activeSounds: [NSSound] = []

    static func playConfettiPop() {
        guard let url = confettiSoundURL(),
              let sound = NSSound(contentsOf: url, byReference: false)
        else {
            playFallbackBurst()
            return
        }

        sound.volume = 0.92
        activeSounds.append(sound)
        sound.play()

        DispatchQueue.main.asyncAfter(deadline: .now() + max(sound.duration, 1.2)) {
            activeSounds.removeAll { $0 === sound }
        }
    }

    private static func confettiSoundURL() -> URL? {
        Bundle.main.url(forResource: "confetti-pop", withExtension: "mp3")
            ?? Bundle.module.url(forResource: "confetti-pop", withExtension: "mp3")
    }

    private static func playFallbackBurst() {
        playSystemSound("Pop", volume: 0.70, delay: 0)
        playSystemSound("Ping", volume: 0.88, delay: 0.07)
        playSystemSound("Bottle", volume: 0.58, delay: 0.16)
        playSystemSound("Pop", volume: 0.45, delay: 0.32)
    }

    private static func playSystemSound(_ name: String, volume: Float, delay: TimeInterval) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            guard let sound = NSSound(named: NSSound.Name(name)) else {
                NSSound.beep()
                return
            }
            sound.volume = volume
            sound.play()
        }
    }
}
