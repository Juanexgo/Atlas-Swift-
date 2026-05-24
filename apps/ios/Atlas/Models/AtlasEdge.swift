//
//  AtlasEdge.swift
//  Atlas
//
//  Connection between two nodes. Strength drives both the force-link
//  attraction and the visual line opacity.
//

import Foundation

enum EdgeKind: String, Codable {
    case link
    case derives
    case tagged
    case mentions
    case semantic
}

struct AtlasEdge: Codable, Identifiable, Hashable {
    let id: String
    var source: String
    var target: String
    var kind: EdgeKind
    var strength: Double
    var createdAt: Int64
}
