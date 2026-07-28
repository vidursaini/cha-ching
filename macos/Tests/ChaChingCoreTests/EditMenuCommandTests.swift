import XCTest
@testable import ChaChingCore

final class EditMenuCommandTests: XCTestCase {
    func testStandardEditMenuIncludesPasteShortcut() {
        XCTAssertTrue(
            StandardEditMenu.commands.contains(
                EditMenuCommand(title: "Paste", selectorName: "paste:", keyEquivalent: "v")
            )
        )
    }

    func testStandardEditMenuRoutesCommonTextEditingCommandsToResponderChain() {
        XCTAssertEqual(
            StandardEditMenu.commands.map(\.selectorName),
            ["undo:", "redo:", "cut:", "copy:", "paste:", "selectAll:"]
        )
    }
}
