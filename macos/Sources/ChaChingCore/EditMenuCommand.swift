import Foundation

public struct EditMenuCommand: Equatable {
    public let title: String
    public let selectorName: String
    public let keyEquivalent: String

    public init(title: String, selectorName: String, keyEquivalent: String) {
        self.title = title
        self.selectorName = selectorName
        self.keyEquivalent = keyEquivalent
    }
}

public enum StandardEditMenu {
    public static let commands: [EditMenuCommand] = [
        EditMenuCommand(title: "Undo", selectorName: "undo:", keyEquivalent: "z"),
        EditMenuCommand(title: "Redo", selectorName: "redo:", keyEquivalent: "Z"),
        EditMenuCommand(title: "Cut", selectorName: "cut:", keyEquivalent: "x"),
        EditMenuCommand(title: "Copy", selectorName: "copy:", keyEquivalent: "c"),
        EditMenuCommand(title: "Paste", selectorName: "paste:", keyEquivalent: "v"),
        EditMenuCommand(title: "Select All", selectorName: "selectAll:", keyEquivalent: "a")
    ]
}
