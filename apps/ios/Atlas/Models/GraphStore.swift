//
//  GraphStore.swift
//  Atlas
//
//  The single source of truth for the live graph. ObservableObject so
//  SwiftUI views re-render when nodes / focus / hover change.
//
//  Layout positions live OUTSIDE @Published — we mutate them in place
//  60 times per second inside the force simulation, and republishing
//  every tick through the Combine pipeline would stall the UI. Instead
//  the GraphCanvas observes the simulation's tick counter and reads
//  positions imperatively. Same trick the web app uses with its
//  Float32Array.
//

import Foundation
import SwiftUI

@MainActor
final class GraphStore: ObservableObject {
    /// Stable node list. Mutating an individual node's title/body/etc.
    /// publishes a change; mutating x/y does not (see comment above).
    @Published private(set) var nodes: [AtlasNode] = []
    @Published private(set) var edges: [AtlasEdge] = []
    @Published var focusId: String?
    @Published var hoverId: String?

    /// `id → index in nodes`. Rebuilt whenever nodes is replaced.
    private(set) var nodeIndex: [String: Int] = [:]

    /// Live positions. Length == nodes.count * 2 (x0, y0, x1, y1, …).
    /// Mutated in place by ForceLayout. NOT a @Published property.
    var positions: [Double] = []

    /// Bump every time the force simulation ticks. Views observing this
    /// repaint without us republishing the whole nodes array.
    @Published private(set) var tick: Int = 0

    func setGraph(nodes: [AtlasNode], edges: [AtlasEdge]) {
        var idx: [String: Int] = [:]
        var pos: [Double] = Array(repeating: 0, count: nodes.count * 2)
        for (i, n) in nodes.enumerated() {
            idx[n.id] = i
            pos[i * 2] = n.x
            pos[i * 2 + 1] = n.y
        }
        // Filter dangling edges defensively.
        let valid = edges.filter { idx[$0.source] != nil && idx[$0.target] != nil }
        self.nodes = nodes
        self.edges = valid
        self.nodeIndex = idx
        self.positions = pos
        self.tick = 0
    }

    /// Called by ForceLayout once per simulation step.
    func didTick() {
        tick &+= 1
    }

    /// O(n) lookup of the node nearest a world point, within its radius.
    /// Used by the tap gesture in GraphCanvas.
    func hitTest(worldX: Double, worldY: Double) -> String? {
        var bestId: String?
        var bestD2 = Double.infinity
        for (i, n) in nodes.enumerated() {
            let nx = positions.indices.contains(i * 2) ? positions[i * 2] : 0
            let ny = positions.indices.contains(i * 2 + 1) ? positions[i * 2 + 1] : 0
            let dx = nx - worldX
            let dy = ny - worldY
            let d2 = dx * dx + dy * dy
            let r = n.radius + 6
            if d2 < r * r && d2 < bestD2 {
                bestD2 = d2
                bestId = n.id
            }
        }
        return bestId
    }

    /// Direct neighbors of a node — used by the focus sheet.
    func neighbors(of nodeId: String, limit: Int = 6) -> [AtlasNode] {
        var out: [AtlasNode] = []
        for e in edges {
            let otherId: String?
            if e.source == nodeId { otherId = e.target }
            else if e.target == nodeId { otherId = e.source }
            else { otherId = nil }
            guard let other = otherId, let i = nodeIndex[other] else { continue }
            out.append(nodes[i])
            if out.count >= limit { break }
        }
        return out
    }
}
