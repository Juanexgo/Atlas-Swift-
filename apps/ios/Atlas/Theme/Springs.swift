//
//  Springs.swift
//  Atlas
//
//  Named spring presets, same tuning as the web/RN apps. SwiftUI's
//  `Animation.spring(...)` takes response + dampingFraction; we convert
//  from the stiffness/damping pair used elsewhere so the feel matches.
//

import SwiftUI

enum Springs {
    /// Instant feedback (hover/press).
    static let snappy: Animation = .spring(response: 0.28, dampingFraction: 0.85)
    /// Default for most transitions.
    static let standard: Animation = .spring(response: 0.36, dampingFraction: 0.78)
    /// Camera flights, focus mode.
    static let cinematic: Animation = .spring(response: 0.55, dampingFraction: 0.74)
    /// Slow ambient motion.
    static let ambient: Animation = .spring(response: 0.9, dampingFraction: 0.72)
}
