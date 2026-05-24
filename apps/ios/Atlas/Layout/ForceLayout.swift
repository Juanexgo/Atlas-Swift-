//
//  ForceLayout.swift
//  Atlas
//
//  Force-directed graph layout. The web app uses d3-force in a Web Worker;
//  this is the equivalent in pure Swift, ticking inside a Timer on the
//  main thread. For ≤300 nodes this stays comfortably above 60fps on an
//  A17 Pro.
//
//  Mutates GraphStore.positions in place (zero allocations per tick).
//  Calls store.didTick() at the end of each tick so the canvas repaints.
//

import Foundation
import SwiftUI

@MainActor
final class ForceLayout {
    private weak var store: GraphStore?

    // Per-node velocity / fixed flags.
    private var vx: [Double] = []
    private var vy: [Double] = []
    private var fixed: [Bool] = []
    private var pinnedX: [Double?] = []
    private var pinnedY: [Double?] = []

    // Force config — mirrors DEFAULT_FORCE_CONFIG in the web app.
    private let charge: Double = -180
    private let linkDistance: Double = 70
    private let linkStrength: Double = 0.6
    private let centerStrength: Double = 0.04
    private let collideRadius: Double = 22
    private let velocityDecay: Double = 0.32
    private let alphaDecay: Double = 0.018
    private let alphaMin: Double = 0.02

    private var alpha: Double = 1.0
    private var displayLink: CADisplayLink?

    init(store: GraphStore) {
        self.store = store
    }

    func start() {
        guard displayLink == nil else { return }
        reseed()
        let link = CADisplayLink(target: ProxyTarget(owner: self), selector: #selector(ProxyTarget.tick))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    /// Called from outside when the user drags a node and we want it stuck.
    /// Pass `nil`s to unpin.
    func pin(id: String, x: Double?, y: Double?) {
        guard let store = store, let i = store.nodeIndex[id] else { return }
        if let x = x, let y = y {
            pinnedX[i] = x
            pinnedY[i] = y
            fixed[i] = true
        } else {
            pinnedX[i] = nil
            pinnedY[i] = nil
            fixed[i] = false
        }
        alpha = max(alpha, 0.3)
    }

    func reheat(_ a: Double = 0.5) {
        alpha = max(alpha, a)
    }

    private func reseed() {
        guard let store = store else { return }
        let n = store.nodes.count
        vx = Array(repeating: 0, count: n)
        vy = Array(repeating: 0, count: n)
        fixed = Array(repeating: false, count: n)
        pinnedX = Array(repeating: nil, count: n)
        pinnedY = Array(repeating: nil, count: n)
        alpha = 1.0
    }

    fileprivate func step() {
        guard let store = store else { return }
        let n = store.nodes.count
        guard n > 0 else { return }
        guard store.positions.count == n * 2 else { return }
        // Re-seed lazily if topology grew/shrank.
        if vx.count != n { reseed() }

        if alpha < alphaMin && !fixed.contains(true) {
            return
        }

        // Body of one tick — accumulate force into velocity, then integrate.
        // Many-body (charge): O(n²) — fine at our scale.
        for i in 0..<n {
            for j in (i + 1)..<n {
                var dx = store.positions[j * 2] - store.positions[i * 2]
                var dy = store.positions[j * 2 + 1] - store.positions[i * 2 + 1]
                var d2 = dx * dx + dy * dy
                if d2 < 1 { d2 = 1; dx = 1; dy = 0 }
                let d = sqrt(d2)
                let force = charge * alpha / d2
                let fx = force * dx / d
                let fy = force * dy / d
                vx[i] += fx
                vy[i] += fy
                vx[j] -= fx
                vy[j] -= fy
            }
        }

        // Link force.
        for e in store.edges {
            guard let i = store.nodeIndex[e.source],
                  let j = store.nodeIndex[e.target] else { continue }
            let dx = store.positions[j * 2] - store.positions[i * 2]
            let dy = store.positions[j * 2 + 1] - store.positions[i * 2 + 1]
            let d = max(sqrt(dx * dx + dy * dy), 0.0001)
            let s = max(0.1, e.strength) * linkStrength * alpha
            let bias = (d - linkDistance) / d * s * 0.5
            let fx = dx * bias
            let fy = dy * bias
            vx[i] += fx
            vy[i] += fy
            vx[j] -= fx
            vy[j] -= fy
        }

        // Centering force (toward origin).
        for i in 0..<n {
            vx[i] -= store.positions[i * 2] * centerStrength * alpha
            vy[i] -= store.positions[i * 2 + 1] * centerStrength * alpha
        }

        // Naive collision (treat each node as a disc of `collideRadius`).
        for i in 0..<n {
            for j in (i + 1)..<n {
                let dx = store.positions[j * 2] - store.positions[i * 2]
                let dy = store.positions[j * 2 + 1] - store.positions[i * 2 + 1]
                let d = sqrt(dx * dx + dy * dy)
                let min = collideRadius * 2
                if d > 0 && d < min {
                    let overlap = (min - d) / d * 0.5
                    let ox = dx * overlap
                    let oy = dy * overlap
                    if !fixed[i] {
                        store.positions[i * 2] -= ox
                        store.positions[i * 2 + 1] -= oy
                    }
                    if !fixed[j] {
                        store.positions[j * 2] += ox
                        store.positions[j * 2 + 1] += oy
                    }
                }
            }
        }

        // Integrate velocity → position with damping. Apply pins.
        for i in 0..<n {
            vx[i] *= (1 - velocityDecay)
            vy[i] *= (1 - velocityDecay)
            if fixed[i], let px = pinnedX[i], let py = pinnedY[i] {
                store.positions[i * 2] = px
                store.positions[i * 2 + 1] = py
                vx[i] = 0
                vy[i] = 0
            } else {
                store.positions[i * 2] += vx[i]
                store.positions[i * 2 + 1] += vy[i]
            }
        }

        alpha *= (1 - alphaDecay)
        store.didTick()
    }
}

/// Tiny ObjC trampoline so CADisplayLink can call a Swift method.
private final class ProxyTarget: NSObject {
    weak var owner: ForceLayout?
    init(owner: ForceLayout) { self.owner = owner }
    @objc func tick() {
        MainActor.assumeIsolated { owner?.step() }
    }
}
