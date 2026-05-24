//
//  AtlasNode.swift
//  Atlas
//
//  Domain model. Mirrors the canonical AtlasNode shape used by the web
//  and React Native apps. Codable for round-trip with the API.
//

import Foundation

enum NodeKind: String, Codable, CaseIterable {
    case note
    case idea
    case task
    case project
    case conversation
    case link
    case memory
    case document
}

enum NodeStatus: String, Codable {
    case active
    case archived
    case pinned
}

struct AtlasNode: Codable, Identifiable, Hashable {
    let id: String
    var kind: NodeKind
    var title: String
    var body: String
    var x: Double
    var y: Double
    var weight: Double
    var status: NodeStatus
    var tags: [String]
    var projectId: String?
    var createdAt: Int64
    var updatedAt: Int64

    /// Display radius derived from weight. Same curve the web and RN apps use.
    var radius: Double {
        10 + pow(weight, 0.65) * 16
    }

    /// Hashing is by id only — position and metadata mutate frequently
    /// during force layout, but identity is stable.
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: AtlasNode, rhs: AtlasNode) -> Bool {
        lhs.id == rhs.id
    }
}
