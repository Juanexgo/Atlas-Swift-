//
//  HUD.swift
//  Atlas
//
//  Heads-up display — top-left mark + subtitle, top-right search trigger,
//  bottom metric pill. Glass surfaces via UltraThinMaterial — the iOS
//  native equivalent of the web's backdrop-filter blur.
//

import SwiftUI

struct HUDView: View {
    @ObservedObject var store: GraphStore
    var onOpenSearch: () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            HStack {
                topLeft
                Spacer()
                topRight
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            VStack {
                Spacer()
                metrics
                    .padding(.bottom, 16)
            }
        }
    }

    private var topLeft: some View {
        HStack(spacing: 10) {
            AtlasMarkView()
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text("Atlas")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AtlasColors.textPrimary)
                    .tracking(-0.2)
                Text("SPATIAL KNOWLEDGE OS")
                    .font(.system(size: 9, weight: .medium))
                    .tracking(1.4)
                    .foregroundStyle(AtlasColors.textTertiary)
            }
            Circle()
                .fill(Color(hex: 0x34D399))
                .frame(width: 6, height: 6)
                .shadow(color: Color(hex: 0x34D399).opacity(0.6), radius: 4)
        }
    }

    private var topRight: some View {
        Button(action: onOpenSearch) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12, weight: .medium))
                Text("Search")
                    .font(.system(size: 13, weight: .medium))
            }
            .foregroundStyle(AtlasColors.textSecondary)
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(AtlasColors.glassBorder, lineWidth: 1)
                    }
            }
        }
        .buttonStyle(.plain)
    }

    private var metrics: some View {
        HStack(spacing: 14) {
            metric(value: "\(store.nodes.count)", label: "NODES")
            divider
            metric(value: "\(store.edges.count)", label: "EDGES")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 9)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(AtlasColors.glassBorder, lineWidth: 1)
                }
        }
    }

    private func metric(value: String, label: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(value)
                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                .foregroundStyle(AtlasColors.textPrimary)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .tracking(1.2)
                .foregroundStyle(AtlasColors.textTertiary)
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(AtlasColors.glassBorder)
            .frame(width: 1, height: 12)
    }
}

// MARK: - Atlas mark

struct AtlasMarkView: View {
    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    LinearGradient(
                        colors: [Color(hex: 0x7CC6FF), Color(hex: 0xA78BFA)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ).opacity(0.65),
                    lineWidth: 1
                )
                .frame(width: 23, height: 23)
            Circle()
                .stroke(
                    LinearGradient(
                        colors: [Color(hex: 0xF472B6), Color(hex: 0x7CC6FF)],
                        startPoint: .bottomLeading,
                        endPoint: .topTrailing
                    ).opacity(0.8),
                    lineWidth: 1
                )
                .frame(width: 15, height: 15)
            Circle()
                .fill(Color(hex: 0x7CC6FF))
                .frame(width: 7, height: 7)
        }
    }
}
