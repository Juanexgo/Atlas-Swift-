//
//  AtlasAPI.swift
//  Atlas
//
//  Thin async client for the Atlas NestJS API. Used by the focus sheet
//  to fetch real AI summaries. When the API is unreachable we throw a
//  cancellation-like error and the caller falls back to the offline
//  summary. URL comes from Info.plist (ATLAS_API_URL key).
//

import Foundation

enum AtlasAPIError: Error {
    case unreachable(String)
    case badStatus(Int, String)
    case malformedResponse
}

struct SummarizeResponse: Decodable {
    let summary: String
}

final class AtlasAPI {
    static let shared = AtlasAPI()

    private let baseURL: URL = {
        // Resolve at init time. Override in Info.plist for production.
        if let raw = Bundle.main.object(forInfoDictionaryKey: "ATLAS_API_URL") as? String,
           let u = URL(string: raw), !raw.isEmpty {
            return u
        }
        return URL(string: "http://localhost:4001")!
    }()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 60
        cfg.timeoutIntervalForResource = 90
        return URLSession(configuration: cfg)
    }()

    func summarize(nodeId: String) async throws -> String {
        let url = baseURL.appendingPathComponent("ai/summarize/\(nodeId)")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw AtlasAPIError.unreachable(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw AtlasAPIError.malformedResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw AtlasAPIError.badStatus(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        let decoded = try JSONDecoder().decode(SummarizeResponse.self, from: data)
        return decoded.summary
    }
}
