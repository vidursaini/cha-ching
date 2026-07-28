import AppKit

enum ChaChingIcon {
    static func menuBarImage() -> NSImage {
        let image = NSImage(size: NSSize(width: 18, height: 18))
        image.lockFocus()
        drawToolbarMark(in: NSRect(x: 0, y: 0, width: 18, height: 18), color: .labelColor)
        image.unlockFocus()
        image.isTemplate = true
        return image
    }

    static func drawToolbarMark(in rect: NSRect, color: NSColor) {
        let scaleX = rect.width / 24
        let scaleY = rect.height / 24

        func point(_ x: CGFloat, _ y: CGFloat) -> NSPoint {
            NSPoint(x: rect.minX + x * scaleX, y: rect.minY + y * scaleY)
        }

        color.setStroke()

        let bell = NSBezierPath()
        bell.lineWidth = max(1.4, rect.width * 0.08)
        bell.lineCapStyle = .round
        bell.lineJoinStyle = .round
        bell.move(to: point(5.1, 6.85))
        bell.curve(
            to: point(6.7, 12.27),
            controlPoint1: point(6.15, 7.93),
            controlPoint2: point(6.7, 9.69)
        )
        bell.curve(
            to: point(12, 18.29),
            controlPoint1: point(6.7, 15.59),
            controlPoint2: point(9.04, 18.29)
        )
        bell.curve(
            to: point(17.3, 12.27),
            controlPoint1: point(14.96, 18.29),
            controlPoint2: point(17.3, 15.59)
        )
        bell.curve(
            to: point(18.9, 6.85),
            controlPoint1: point(17.3, 9.69),
            controlPoint2: point(17.85, 7.93)
        )
        bell.line(to: point(5.1, 6.85))
        bell.stroke()

        let stem = NSBezierPath()
        stem.lineWidth = bell.lineWidth
        stem.lineCapStyle = .round
        stem.move(to: point(12, 18.65))
        stem.line(to: point(12, 20.75))
        stem.stroke()

        let clapper = NSBezierPath()
        clapper.lineWidth = bell.lineWidth
        clapper.lineCapStyle = .round
        clapper.move(to: point(9.9, 3.9))
        clapper.curve(
            to: point(14.1, 3.9),
            controlPoint1: point(10.32, 3.16),
            controlPoint2: point(13.68, 3.16)
        )
        clapper.stroke()

        let dollar = NSBezierPath()
        dollar.lineWidth = max(1.3, rect.width * 0.075)
        dollar.lineCapStyle = .round
        dollar.lineJoinStyle = .round
        dollar.move(to: point(14.55, 14.45))
        dollar.curve(
            to: point(12.37, 15.33),
            controlPoint1: point(14.03, 15.01),
            controlPoint2: point(13.27, 15.33)
        )
        dollar.curve(
            to: point(10.35, 13.94),
            controlPoint1: point(11.24, 15.33),
            controlPoint2: point(10.35, 14.79)
        )
        dollar.curve(
            to: point(14.6, 10.47),
            controlPoint1: point(10.35, 11.88),
            controlPoint2: point(14.6, 12.92)
        )
        dollar.curve(
            to: point(12.18, 8.67),
            controlPoint1: point(14.6, 9.44),
            controlPoint2: point(13.63, 8.67)
        )
        dollar.curve(
            to: point(9.63, 9.62),
            controlPoint1: point(11.18, 8.67),
            controlPoint2: point(10.3, 9.01)
        )
        dollar.stroke()

        let dollarStem = NSBezierPath()
        dollarStem.lineWidth = dollar.lineWidth
        dollarStem.lineCapStyle = .round
        dollarStem.move(to: point(12.08, 7.6))
        dollarStem.line(to: point(12.08, 16.32))
        dollarStem.stroke()
    }
}
