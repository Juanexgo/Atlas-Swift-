//
//  AtlasColors.swift
//  Atlas
//
//  The Atlas palette. Hexes match the web and React Native apps
//  byte-for-byte — same NODE_KIND_ACCENT mapping.
//

import SwiftUI

enum AtlasColors {
    // MARK: - Accents (per NodeKind)

    static let aurora = Color(hex: 0x7CC6FF)
    static let nebula = Color(hex: 0xA78BFA)
    static let plasma = Color(hex: 0xF472B6)
    static let solar = Color(hex: 0xFCD34D)
    static let forest = Color(hex: 0x6EE7B7)
    static let coral = Color(hex: 0xFB923C)
    static let indigo = Color(hex: 0x818CF8)

    /// Same kind → accent mapping the web app uses (NODE_KIND_ACCENT).
    static func accent(for kind: NodeKind) -> Color {
        switch kind {
        case .note: return aurora
        case .idea: return solar
        case .task: return forest
        case .project: return indigo
        case .conversation: return plasma
        case .link: return coral
        case .memory: return nebula
        case .document: return aurora
        }
    }

    // MARK: - Surfaces

    static let void = Color.black
    static let ink = Color(hex: 0x06070A)
    static let graphite = Color(hex: 0x0E1014)

    static let glassBase = Color.white.opacity(0.05)
    static let glassRaised = Color.white.opacity(0.07)
    static let glassFloating = Color.white.opacity(0.09)
    static let glassBorder = Color.white.opacity(0.10)
    static let glassBorderStrong = Color.white.opacity(0.16)

    // MARK: - Text

    static let textPrimary = Color.white.opacity(0.96)
    static let textSecondary = Color.white.opacity(0.64)
    static let textTertiary = Color.white.opacity(0.42)
    static let textQuaternary = Color.white.opacity(0.22)
}

extension Color {
    /// Initialize from a 6-digit hex literal: Color(hex: 0xFF8800)
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}
