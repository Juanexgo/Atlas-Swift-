//
//  CommandSheet.swift
//  Atlas
//
//  Bottom-sheet search palette — the iOS mirror of the web's ⌘K.
//  TextField at the top, filtered list below. Substring + token scoring,
//  ranked by prefix > word-start > substring (same rules as the web).
//

import SwiftUI

struct CommandSheet: View {
    @ObservedObject var store: GraphStore
    var onSelect: (String) -> Void
    var onClose: () -> Void

    @State private var query: String = ""
    @FocusState private var fieldFocused: Bool

    private var filtered: [AtlasNode] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty {
            return Array(store.nodes.prefix(30))
        }
        let tokens = q.split(separator: " ").map(String.init)
        let scored = store.nodes.map { (n: AtlasNode) -> (AtlasNode, Int) in
            (n, score(title: n.title.lowercased(), tokens: tokens))
        }
        return scored
            .filter { $0.1 > 0 }
            .sorted { $0.1 > $1.1 }
            .prefix(30)
            .map(\.0)
    }

    var body: some View {
        ZStack {
            // Scrim
            Color.black.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture { onClose() }

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 0) {
                    // Input
                    TextField("", text: $query, prompt: Text("Jump to anything…")
                        .foregroundStyle(AtlasColors.textTertiary))
                        .focused($fieldFocused)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(AtlasColors.textPrimary)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 16)
                        .background(AtlasColors.ink.opacity(0.6))

                    Divider().background(AtlasColors.glassBorder)

                    // List
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(filtered) { node in
                                row(for: node)
                            }
                            if filtered.isEmpty {
                                Text("No matches.")
                                    .font(.system(size: 13))
                                    .foregroundStyle(AtlasColors.textTertiary)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 32)
                            }
                        }
                    }
                    .frame(maxHeight: 360)
                }
                .background {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay {
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .stroke(AtlasColors.glassBorderStrong, lineWidth: 1)
                        }
                }
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
        }
        .transition(.opacity)
        .onAppear { fieldFocused = true }
    }

    private func row(for node: AtlasNode) -> some View {
        Button {
            onSelect(node.id)
        } label: {
            HStack(spacing: 10) {
                Circle()
                    .fill(AtlasColors.accent(for: node.kind))
                    .frame(width: 6, height: 6)
                Text(node.title)
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.textPrimary)
                    .lineLimit(1)
                Spacer()
                Text(node.kind.rawValue.uppercased())
                    .font(.system(size: 10))
                    .tracking(1)
                    .foregroundStyle(AtlasColors.textTertiary)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func score(title: String, tokens: [String]) -> Int {
        var s = 0
        for t in tokens {
            if title.hasPrefix(t) {
                s += 100
            } else if title.range(of: "\\b" + NSRegularExpression.escapedPattern(for: t),
                                  options: .regularExpression) != nil {
                s += 60
            } else if title.contains(t) {
                s += 30
            } else {
                return 0
            }
        }
        return s
    }
}
