//
//  SeedData.swift
//  Atlas
//
//  Deterministic seed graph — mirrors the web and RN seeds. 25 nodes
//  across 6 clusters, with hand-picked cross-cluster semantic edges.
//

import Foundation

private struct Spec {
    let title: String
    let kind: NodeKind
    let cluster: String
    let weight: Double
    let tags: [String]
}

private let SPECS: [Spec] = [
    .init(title: "Atlas v0 — the spatial OS", kind: .project, cluster: "atlas", weight: 1.0, tags: ["flagship"]),
    .init(title: "Hybrid: instanced WebGL + DOM focus card", kind: .note, cluster: "atlas", weight: 0.85, tags: []),
    .init(title: "Force layout on a worker", kind: .task, cluster: "atlas", weight: 0.6, tags: []),
    .init(title: "GPU picking for hit-testing", kind: .task, cluster: "atlas", weight: 0.55, tags: []),
    .init(title: "Yjs as source of truth, React as projection", kind: .note, cluster: "atlas", weight: 0.8, tags: []),
    .init(title: "Adaptive accent extracted from node", kind: .idea, cluster: "atlas", weight: 0.45, tags: []),
    .init(title: "Command palette spec", kind: .document, cluster: "atlas", weight: 0.6, tags: []),

    .init(title: "AI relationship mapping", kind: .project, cluster: "ai", weight: 0.95, tags: ["ai"]),
    .init(title: "HDBSCAN clusters → LLM labeling", kind: .idea, cluster: "ai", weight: 0.7, tags: []),
    .init(title: "Semantic search query", kind: .task, cluster: "ai", weight: 0.5, tags: []),
    .init(title: "Ollama local for offline", kind: .note, cluster: "ai", weight: 0.55, tags: []),

    .init(title: "Atlas iOS — native SwiftUI", kind: .project, cluster: "ios", weight: 0.8, tags: []),
    .init(title: "Canvas-based renderer with glow", kind: .task, cluster: "ios", weight: 0.55, tags: []),
    .init(title: "Spring-damped camera in SwiftUI", kind: .task, cluster: "ios", weight: 0.5, tags: []),
    .init(title: "TestFlight distribution", kind: .idea, cluster: "ios", weight: 0.4, tags: []),

    .init(title: "Realtime sync architecture", kind: .project, cluster: "sync", weight: 0.75, tags: []),
    .init(title: "Yjs over WebSocket", kind: .task, cluster: "sync", weight: 0.55, tags: []),
    .init(title: "Offline-first via IndexedDB", kind: .note, cluster: "sync", weight: 0.55, tags: []),

    .init(title: "Apple HIG: spatial design principles", kind: .link, cluster: "insp", weight: 0.4, tags: []),
    .init(title: "Arc Browser command bar", kind: .document, cluster: "insp", weight: 0.55, tags: []),
    .init(title: "Linear graph view post-mortem", kind: .document, cluster: "insp", weight: 0.5, tags: []),
    .init(title: "Visit to Figma offices", kind: .memory, cluster: "insp", weight: 0.4, tags: []),

    .init(title: "Daily standup", kind: .note, cluster: "today", weight: 0.3, tags: []),
    .init(title: "Tomorrow: pair on shaders", kind: .task, cluster: "today", weight: 0.35, tags: []),
    .init(title: "Chat with Jess about spatial Arc", kind: .conversation, cluster: "today", weight: 0.5, tags: []),
]

private let CENTERS: [String: (Double, Double)] = [
    "atlas": (0, 0),
    "ai":    (420, 180),
    "ios":   (-440, -160),
    "sync":  (180, -380),
    "insp":  (-320, 360),
    "today": (380, -340),
]

/// Mulberry32 — same deterministic PRNG as the JS seeds, so iOS and web
/// produce identical layouts when given the same seed.
private final class Mulberry32 {
    private var state: UInt32
    init(_ seed: UInt32) { self.state = seed }
    func next() -> Double {
        state &+= 0x6d2b79f5
        var t: UInt32 = state
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return Double((t ^ (t >> 14)) & 0xFFFFFFFF) / Double(UInt32.max)
    }
}

private func makeId(_ prefix: Character) -> String {
    let suffix = String(UUID().uuidString.prefix(8)).lowercased()
    return "\(prefix)_\(suffix)"
}

enum SeedData {
    static func generate() -> (nodes: [AtlasNode], edges: [AtlasEdge]) {
        let rng = Mulberry32(11)
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        var nodes: [AtlasNode] = []
        var byTitle: [String: String] = [:]

        for spec in SPECS {
            let center = CENTERS[spec.cluster] ?? (0, 0)
            let r = 50 + rng.next() * 200
            let θ = rng.next() * .pi * 2
            let id = makeId("n")
            let node = AtlasNode(
                id: id,
                kind: spec.kind,
                title: spec.title,
                body: bodyFor(rng: rng),
                x: center.0 + cos(θ) * r,
                y: center.1 + sin(θ) * r,
                weight: spec.weight,
                status: .active,
                tags: spec.tags,
                projectId: nil,
                createdAt: now - Int64(rng.next() * 1000 * 60 * 60 * 24 * 30),
                updatedAt: now - Int64(rng.next() * 1000 * 60 * 60 * 24 * 7)
            )
            nodes.append(node)
            byTitle[spec.title] = id
        }

        var edges: [AtlasEdge] = []

        // Project → siblings within each cluster.
        var byCluster: [String: [AtlasNode]] = [:]
        for (i, n) in nodes.enumerated() {
            let cluster = SPECS[i].cluster
            byCluster[cluster, default: []].append(n)
        }
        for (_, list) in byCluster {
            guard let project = list.first(where: { $0.kind == .project }) else { continue }
            for child in list where child.id != project.id {
                edges.append(AtlasEdge(
                    id: makeId("e"),
                    source: project.id,
                    target: child.id,
                    kind: .link,
                    strength: 0.55 + rng.next() * 0.2,
                    createdAt: now
                ))
            }
        }

        // Cross-cluster semantic edges.
        let cross: [(String, String, Double)] = [
            ("AI relationship mapping", "Atlas v0 — the spatial OS", 0.8),
            ("Realtime sync architecture", "Atlas v0 — the spatial OS", 0.7),
            ("Atlas iOS — native SwiftUI", "Atlas v0 — the spatial OS", 0.75),
            ("Yjs as source of truth, React as projection", "Yjs over WebSocket", 0.85),
            ("Yjs as source of truth, React as projection", "Offline-first via IndexedDB", 0.75),
            ("Arc Browser command bar", "Command palette spec", 0.7),
            ("Linear graph view post-mortem", "GPU picking for hit-testing", 0.6),
            ("Hybrid: instanced WebGL + DOM focus card", "Canvas-based renderer with glow", 0.7),
        ]
        for (a, b, s) in cross {
            guard let idA = byTitle[a], let idB = byTitle[b] else { continue }
            edges.append(AtlasEdge(
                id: makeId("e"),
                source: idA,
                target: idB,
                kind: .semantic,
                strength: s,
                createdAt: now
            ))
        }

        return (nodes, edges)
    }
}

private let FILLER = [
    "Quick capture; flesh out later.",
    "Three options under consideration. Decision by Friday.",
    "Reference for the spatial interaction model — pinned for re-read.",
    "Status: blocked on the camera anchor work.",
    "Top of mind — ties back to the v0 ship goal.",
    "Recurring theme in the design reviews.",
]

private func bodyFor(rng: Mulberry32) -> String {
    let i = Int(rng.next() * Double(FILLER.count))
    return FILLER[min(i, FILLER.count - 1)]
}
