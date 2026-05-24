//
//  GraphCanvas.swift
//  Atlas
//
//  The Skia-equivalent of the web's R3F canvas, written with SwiftUI's
//  declarative Canvas API. One draw call per frame:
//    1. Edges as a single Path (incident ones brightened on focus)
//    2. Nodes with a soft glow halo + solid core + inner highlight
//
//  Camera transform comes from a struct held in @Binding by the parent
//  — pan + pinch gestures mutate it; the canvas reads it during draw.
//

import SwiftUI

struct CameraTransform {
    var tx: Double = 0
    var ty: Double = 0
    var scale: Double = 1.0
}

struct GraphCanvas: View {
    @ObservedObject var store: GraphStore
    @Binding var camera: CameraTransform

    /// Tap callback — the parent routes it into hit-testing + focus.
    var onTap: (Double, Double) -> Void

    @GestureState private var dragTranslation: CGSize = .zero
    @GestureState private var pinchScale: CGFloat = 1.0
    @State private var savedTx: Double = 0
    @State private var savedTy: Double = 0
    @State private var savedScale: Double = 1.0

    var body: some View {
        GeometryReader { geo in
            // We bind to store.tick so SwiftUI repaints once per
            // simulation step. The actual positions are read from
            // store.positions inside the Canvas closure.
            let _ = store.tick

            Canvas(opaque: false, colorMode: .linear, rendersAsynchronously: false) { context, size in
                drawScene(into: context, size: size)
            }
            .gesture(
                SimultaneousGesture(
                    DragGesture(minimumDistance: 0)
                        .updating($dragTranslation) { value, state, _ in
                            state = value.translation
                        }
                        .onChanged { value in
                            camera.tx = savedTx + value.translation.width
                            camera.ty = savedTy + value.translation.height
                        }
                        .onEnded { value in
                            savedTx = camera.tx
                            savedTy = camera.ty
                            // Treat a tiny-drag as a tap.
                            let dx = value.translation.width
                            let dy = value.translation.height
                            if abs(dx) < 6 && abs(dy) < 6 {
                                let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
                                let wx = (value.location.x - center.x - camera.tx) / camera.scale
                                let wy = (value.location.y - center.y - camera.ty) / camera.scale
                                onTap(wx, wy)
                            }
                        },
                    MagnificationGesture()
                        .updating($pinchScale) { value, state, _ in
                            state = value
                        }
                        .onChanged { value in
                            camera.scale = max(0.3, min(3.5, savedScale * Double(value)))
                        }
                        .onEnded { _ in
                            savedScale = camera.scale
                        }
                )
            )
        }
    }

    // MARK: - Draw

    private func drawScene(into context: GraphicsContext, size: CGSize) {
        let centerX = size.width / 2 + camera.tx
        let centerY = size.height / 2 + camera.ty
        let s = camera.scale

        // 1. Edges — single Path, two sub-paths (incident + normal).
        let focusIdx = store.focusId.flatMap { store.nodeIndex[$0] } ?? -1

        var normalPath = Path()
        var incidentPath = Path()
        for edge in store.edges {
            guard let si = store.nodeIndex[edge.source],
                  let ti = store.nodeIndex[edge.target] else { continue }
            guard store.positions.indices.contains(ti * 2 + 1) else { continue }
            let sx = centerX + store.positions[si * 2] * s
            let sy = centerY + store.positions[si * 2 + 1] * s
            let tx = centerX + store.positions[ti * 2] * s
            let ty = centerY + store.positions[ti * 2 + 1] * s
            let isIncident = focusIdx >= 0 && (si == focusIdx || ti == focusIdx)
            if isIncident {
                incidentPath.move(to: CGPoint(x: sx, y: sy))
                incidentPath.addLine(to: CGPoint(x: tx, y: ty))
            } else {
                normalPath.move(to: CGPoint(x: sx, y: sy))
                normalPath.addLine(to: CGPoint(x: tx, y: ty))
            }
        }
        let normalColor: Color = focusIdx >= 0
            ? Color(.sRGB, red: 0.78, green: 0.86, blue: 1.0, opacity: 0.04)
            : Color(.sRGB, red: 0.78, green: 0.86, blue: 1.0, opacity: 0.14)
        context.stroke(normalPath, with: .color(normalColor), lineWidth: 1)
        context.stroke(incidentPath,
                       with: .color(Color(.sRGB, red: 0.55, green: 0.78, blue: 1.0, opacity: 0.6)),
                       lineWidth: 1.5)

        // 2. Nodes — halo + glow + core + highlight per node.
        for (i, node) in store.nodes.enumerated() {
            guard store.positions.indices.contains(i * 2 + 1) else { continue }
            let x = centerX + store.positions[i * 2] * s
            let y = centerY + store.positions[i * 2 + 1] * s
            let accent = AtlasColors.accent(for: node.kind)
            let isFocused = node.id == store.focusId
            let dimmed = store.focusId != nil && !isFocused
            let scale = isFocused ? 1.25 : 1.0
            let r = node.radius * s * scale
            let opacity = dimmed ? 0.32 : 1.0

            // Halo (only on focused).
            if isFocused {
                let halo = Path(ellipseIn: CGRect(x: x - r - 14, y: y - r - 14,
                                                  width: (r + 14) * 2, height: (r + 14) * 2))
                var c = context
                c.addFilter(.blur(radius: 10))
                c.fill(halo, with: .color(accent.opacity(0.2 * opacity)))
            }

            // Glow ring.
            let glow = Path(ellipseIn: CGRect(x: x - r - 4, y: y - r - 4,
                                              width: (r + 4) * 2, height: (r + 4) * 2))
            var glowCtx = context
            glowCtx.addFilter(.blur(radius: isFocused ? 8 : 4))
            glowCtx.fill(glow, with: .color(accent.opacity(0.45 * opacity)))

            // Core.
            let core = Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
            context.fill(core, with: .color(accent.opacity(opacity)))

            // Highlight — top-left "lit from above".
            let h = r * 0.55
            let hi = Path(ellipseIn: CGRect(x: x - h, y: y - r * 0.3 - h,
                                            width: h * 2, height: h * 2))
            context.fill(hi, with: .color(Color.white.opacity(opacity * 0.16)))
        }
    }
}
