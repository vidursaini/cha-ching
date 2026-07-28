import XCTest
@testable import ChaChingCore

final class ProviderConfigTests: XCTestCase {
    func testEncodesSuperwallProviderConfigRequest() throws {
        let request = ProviderConfigRequest(
            configId: "cc_sw_existing",
            provider: .superwall,
            displayName: "Nimbus Notes",
            webhookSecret: "whsec_test"
        )

        let payload = try JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]

        XCTAssertEqual(payload?["provider"] as? String, "superwall")
        XCTAssertEqual(payload?["configId"] as? String, "cc_sw_existing")
        XCTAssertEqual(payload?["displayName"] as? String, "Nimbus Notes")
        XCTAssertEqual(payload?["webhookSecret"] as? String, "whsec_test")
    }

    func testEncodesDisabledGenerateURLProviderConfigRequest() throws {
        let request = ProviderConfigRequest(
            provider: .superwall,
            enabled: false,
            displayName: "Nimbus Notes"
        )

        let payload = try JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]

        XCTAssertEqual(payload?["provider"] as? String, "superwall")
        XCTAssertEqual(payload?["enabled"] as? Bool, false)
        XCTAssertNil(payload?["webhookSecret"])
    }

    func testDecodesProviderConfigWebhookURL() throws {
        let data = """
        {
          "config": {
            "id": "cc_sw_test",
            "provider": "superwall",
            "displayName": "Nimbus Notes",
            "enabled": true,
            "keyHint": "...test",
            "webhookUrl": "https://chaching-api.vidursaini.com/api/webhooks/superwall/cc_sw_test",
            "updatedAt": "2026-06-18T10:00:00.000Z"
          }
        }
        """.data(using: .utf8)!

        let response = try RevenueJSONDecoder.make().decode(ProviderConfigResponse.self, from: data)

        XCTAssertEqual(response.config.provider, .superwall)
        XCTAssertEqual(response.config.id, "cc_sw_test")
        XCTAssertEqual(response.config.displayName, "Nimbus Notes")
        XCTAssertEqual(response.config.webhookURL, "https://chaching-api.vidursaini.com/api/webhooks/superwall/cc_sw_test")
        XCTAssertEqual(response.config.keyHint, "...test")
    }

    func testDecodesLegacyProviderConfigWithoutID() throws {
        let data = """
        {
          "config": {
            "provider": "superwall",
            "enabled": true,
            "webhookUrl": "https://chaching-api.vidursaini.com/api/webhooks/superwall/cc_sw_legacy",
            "updatedAt": "2026-06-18T10:00:00.000Z"
          }
        }
        """.data(using: .utf8)!

        let response = try RevenueJSONDecoder.make().decode(ProviderConfigResponse.self, from: data)

        XCTAssertEqual(response.config.id, response.config.webhookURL)
        XCTAssertNil(response.config.displayName)
    }
}
