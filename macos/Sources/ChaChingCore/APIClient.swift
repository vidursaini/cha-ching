import Foundation

public struct APIClient: Sendable {
    public enum ClientError: Error, Equatable {
        case invalidURL
        case badStatus(Int)
    }

    public let baseURL: URL
    public let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public func activate(licenseKey: String, deviceName: String) async throws -> String {
        var request = try jsonRequest(path: "/api/licenses/activate", method: "POST")
        request.httpBody = try JSONEncoder().encode(["licenseKey": licenseKey, "deviceName": deviceName])
        let response: ActivationResponse = try await send(request)
        return response.deviceToken
    }

    public func activateSelfHosted(setupToken: String, deviceName: String) async throws -> String {
        var request = try jsonRequest(path: "/api/self-host/activate", method: "POST")
        request.httpBody = try JSONEncoder().encode(["setupToken": setupToken, "deviceName": deviceName])
        let response: ActivationResponse = try await send(request)
        return response.deviceToken
    }

    public func fetchMetadata() async throws -> APIMetadata {
        let request = URLRequest(url: baseURL.appendingPathComponent("/api/meta"))
        return try await send(request)
    }

    public func fetchSync(deviceToken: String, after cursor: Int) async throws -> SyncResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/sync"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "after", value: String(cursor)),
            URLQueryItem(name: "limit", value: "50")
        ]
        guard let url = components?.url else { throw ClientError.invalidURL }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
        do {
            return try await send(request)
        } catch ClientError.badStatus(404) {
            async let events = fetchEvents(deviceToken: deviceToken, after: cursor)
            async let summary = fetchSummary(deviceToken: deviceToken)
            let legacyEvents = try await events
            return try await SyncResponse(
                events: legacyEvents,
                summary: summary,
                serverTime: Date(),
                pollAfterSeconds: legacyEvents.isEmpty ? 60 : 10
            )
        }
    }

    public func fetchEvents(deviceToken: String, after cursor: Int) async throws -> [RevenueEvent] {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/events"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "after", value: String(cursor)),
            URLQueryItem(name: "limit", value: "50")
        ]
        guard let url = components?.url else { throw ClientError.invalidURL }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
        let response: EventsResponse = try await send(request)
        return response.events
    }

    public func fetchSummary(deviceToken: String) async throws -> RevenueSummary {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/revenue-card"))
        request.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
        return try await send(request)
    }

    public func saveProviderConfig(deviceToken: String, request body: ProviderConfigRequest) async throws -> ProviderConfigSummary {
        var request = try jsonRequest(path: "/api/provider-configs", method: "POST")
        request.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(body)
        let response: ProviderConfigResponse = try await send(request)
        return response.config
    }

    public func fetchProviderConfigs(deviceToken: String) async throws -> [ProviderConfigSummary] {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/provider-configs"))
        request.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
        let response: ProviderConfigsResponse = try await send(request)
        return response.configs
    }

    private func jsonRequest(path: String, method: String) throws -> URLRequest {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw ClientError.badStatus(http.statusCode)
        }
        return try RevenueJSONDecoder.make().decode(T.self, from: data)
    }
}

private struct ActivationResponse: Decodable {
    let deviceToken: String
}
