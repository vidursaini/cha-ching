import XCTest
@testable import ChaChingCore

final class BackendURLValidatorTests: XCTestCase {
    func testAcceptsSecureWorkerURL() {
        XCTAssertEqual(
            BackendURLValidator.validatedURL("https://example.workers.dev")?.absoluteString,
            "https://example.workers.dev"
        )
    }

    func testAllowsHTTPOnlyForLocalDevelopment() {
        XCTAssertNotNil(BackendURLValidator.validatedURL("http://localhost:8787"))
        XCTAssertNil(BackendURLValidator.validatedURL("http://example.com"))
    }

    func testRejectsCredentialsAndUnexpectedPaths() {
        XCTAssertNil(BackendURLValidator.validatedURL("https://token@example.com"))
        XCTAssertNil(BackendURLValidator.validatedURL("https://example.com/api"))
    }
}
