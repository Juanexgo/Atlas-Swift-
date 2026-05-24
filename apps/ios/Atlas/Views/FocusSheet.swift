//
//  FocusSheet.swift
//  Atlas
//
//  Bottom sheet that appears when a node is tapped. Mirrors the web's
//  FocusCard: kind chip, title, body, tags, AI summarize button,
//  neighbor list.
//

import SwiftUI

struct FocusSheet: View {
    @ObservedObject var store: GraphStore
    var nodeId: String
    var onClose: () -> Void

    @State private var summary: String?
    @State private var summarizing = false

    private var node: AtlasNode? {
        store.nodeIndex[nodeId].map { store.nodes[$0] }
    }

    var body: some View {
        if let node = node {
            VStack(spacing: 0) {
                accentStrip(color: AtlasColors.accent(for: node.kind))
                content(for: node)
            }
            .background {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay {
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(AtlasColors.glassBorderStrong, lineWidth: 1)
                    }
                    .background(AtlasColors.ink.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .padding(.horizontal, 20)
            .padding(.bottom, 80)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .onChange(of: nodeId) {
                summary = nil
            }
        }
    }

    private func accentStrip(color: Color) -> some View {
        LinearGradient(
            colors: [.clear, color, .clear],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(height: 2)
        .shadow(color: color, radius: 3)
    }

    @ViewBuilder
    private func content(for node: AtlasNode) -> some View {
        let accent = AtlasColors.accent(for: node.kind)
        let neighbors = store.neighbors(of: node.id)

        VStack(alignment: .leading, spacing: 0) {
            // Header row
            HStack {
                kindChip(node.kind.rawValue.uppercased(), accent: accent)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AtlasColors.textTertiary)
                        .padding(8)
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 10)

            Text(node.title)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(AtlasColors.textPrimary)
                .tracking(-0.3)
                .fixedSize(horizontal: false, vertical: true)

            if !node.body.isEmpty {
                Text(node.body)
                    .font(.system(size: 13.5))
                    .foregroundStyle(AtlasColors.textSecondary)
                    .lineSpacing(4)
                    .padding(.top, 8)
            }

            if !node.tags.isEmpty {
                tagsRow(node.tags)
                    .padding(.top, 10)
            }

            // AI summarize button
            Button(action: requestSummary) {
                HStack(spacing: 6) {
                    Text("✦")
                        .font(.system(size: 11))
                    Text(summarizing ? "Summarizing…" : (summary != nil ? "Refresh summary" : "Summarize with AI"))
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(AtlasColors.textSecondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background {
                    Capsule()
                        .fill(AtlasColors.glassBase)
                        .overlay {
                            Capsule().stroke(AtlasColors.glassBorder, lineWidth: 1)
                        }
                }
            }
            .buttonStyle(.plain)
            .disabled(summarizing)
            .padding(.top, 14)

            if let summary = summary {
                Text(summary)
                    .font(.system(size: 12.5))
                    .foregroundStyle(AtlasColors.textSecondary)
                    .lineSpacing(3)
                    .padding(12)
                    .background {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(AtlasColors.glassBase)
                            .overlay {
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(AtlasColors.glassBorder, lineWidth: 1)
                            }
                    }
                    .padding(.top, 12)
            }

            // Connected list
            if !neighbors.isEmpty {
                Divider()
                    .background(AtlasColors.glassBorder)
                    .padding(.top, 14)

                Text("CONNECTED")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(AtlasColors.textTertiary)
                    .padding(.top, 12)
                    .padding(.bottom, 4)

                ForEach(neighbors) { n in
                    Button {
                        withAnimation(Springs.cinematic) {
                            store.focusId = n.id
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Circle()
                                .fill(AtlasColors.accent(for: n.kind))
                                .frame(width: 6, height: 6)
                            Text(n.title)
                                .font(.system(size: 12.5))
                                .foregroundStyle(AtlasColors.textSecondary)
                                .lineLimit(1)
                            Spacer()
                            Text(n.kind.rawValue.uppercased())
                                .font(.system(size: 10))
                                .tracking(1)
                                .foregroundStyle(AtlasColors.textTertiary)
                        }
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(18)
    }

    private func kindChip(_ label: String, accent: Color) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(accent)
                .frame(width: 6, height: 6)
                .shadow(color: accent, radius: 3)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(accent)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background {
            Capsule()
                .fill(accent.opacity(0.08))
                .overlay {
                    Capsule().stroke(accent.opacity(0.25), lineWidth: 1)
                }
        }
    }

    private func tagsRow(_ tags: [String]) -> some View {
        FlowLayout(spacing: 6) {
            ForEach(tags, id: \.self) { tag in
                Text("#\(tag)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(AtlasColors.textSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background {
                        Capsule().fill(AtlasColors.glassRaised)
                    }
            }
        }
    }

    private func requestSummary() {
        guard !summarizing, let node = node else { return }
        summarizing = true
        Task {
            do {
                let result = try await AtlasAPI.shared.summarize(nodeId: node.id)
                await MainActor.run {
                    self.summary = result
                    self.summarizing = false
                }
            } catch {
                await MainActor.run {
                    self.summary = offlineSummary(for: node)
                    self.summarizing = false
                }
            }
        }
    }

    private func offlineSummary(for node: AtlasNode) -> String {
        var parts: [String] = []
        parts.append("A \(node.kind.rawValue) titled \"\(node.title)\".")
        if !node.body.isEmpty {
            parts.append(String(node.body.prefix(160)))
        }
        let neighbors = store.neighbors(of: node.id, limit: 3)
        if !neighbors.isEmpty {
            let titles = neighbors.map(\.title).joined(separator: ", ")
            parts.append("Connected to: \(titles).")
        }
        parts.append("(Offline — start the API to enable AI summaries.)")
        return parts.joined(separator: " ")
    }
}

// MARK: - Tiny flow layout for tags

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rowWidth: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let sz = sub.sizeThatFits(.unspecified)
            if rowWidth + sz.width > maxWidth {
                totalHeight += rowHeight + spacing
                rowWidth = sz.width + spacing
                rowHeight = sz.height
            } else {
                rowWidth += sz.width + spacing
                rowHeight = max(rowHeight, sz.height)
            }
        }
        totalHeight += rowHeight
        return CGSize(width: maxWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let sz = sub.sizeThatFits(.unspecified)
            if x + sz.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(sz))
            x += sz.width + spacing
            rowHeight = max(rowHeight, sz.height)
        }
    }
}
