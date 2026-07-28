import XCTest
@testable import ChaChingCore

final class CursorStoreTests: XCTestCase {
    func testSavesHighestProcessedEventID() {
        let defaults = UserDefaults(suiteName: "ChaChing.CursorStoreTests.\(UUID().uuidString)")!
        let store = CursorStore(key: "cursor", defaults: defaults)

        store.saveAfterProcessing(DemoEventFactory.events())

        XCTAssertEqual(store.load(), 2)
    }
}
