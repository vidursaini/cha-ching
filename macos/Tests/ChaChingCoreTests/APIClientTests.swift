import Foundation
import XCTest
@testable import ChaChingCore

final class APIClientTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.handler = nil
        super.tearDown()
    }

    func testSyncFallsBackToLegacyEndpointsWhenServerHasNotBeenUpdated() async throws {
        StubURLProtocol.handler = { request in
            switch request.url?.path {
            case "/api/sync":
                return (404, Data("{}".utf8))
            case "/api/events":
                return (200, Data(#"{"events":[]}"#.utf8))
            case "/api/revenue-card":
                return (200, Data(#"{"todayRevenue":0,"todayEvents":0,"appBreakdown":[]}"#.utf8))
            default:
                return (500, Data())
            }
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: URLSession(configuration: configuration)
        )

        let response = try await client.fetchSync(deviceToken: "device", after: 0)

        XCTAssertTrue(response.events.isEmpty)
        XCTAssertEqual(response.summary.todayRevenue, 0)
        XCTAssertEqual(response.pollAfterSeconds, 60)
    }
}

private final class StubURLProtocol: URLProtocol, @unchecked Sendable {
    static var handler: ((URLRequest) -> (Int, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        let (status, data) = handler(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
