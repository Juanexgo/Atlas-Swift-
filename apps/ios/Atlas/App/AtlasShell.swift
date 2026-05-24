//
//  AtlasShell.swift
//  Atlas
//
//  Root composition. Owns the GraphStore, the camera state, and the
//  ForceLayout instance. Switches between the canvas, focus sheet, and
//  command sheet views.
//
//  Lifecycle:
//   - On appear, seed the graph and start the force simulation.
//   - On disappear, stop the simulation to release the CADisplayLink.
//

import SwiftUI

struct AtlasShell: View {
    @StateObject private var store = GraphStore()
    @State private var camera = CameraTransform()
    @State private var showSearch = false
    @State private var layout: ForceLayout?

    var body: some View {
        ZStack {
            AtlasBackground()
            GraphCanvas(store: store, camera: $camera, onTap: handleTap)
                .ignoresSafeArea()

            HUDView(store: store, onOpenSearch: {
                withAnimation(Springs.standard) { showSearch = true }
            })

            if let focusId = store.focusId {
                FocusSheet(store: store, nodeId: focusId, onClose: {
                    impact(.selection)
                    withAnimation(Springs.cinematic) { store.focusId = nil }
                })
            }

            if showSearch {
                CommandSheet(
                    store: store,
                    onSelect: { id in
                        impact(.light)
                        showSearch = false
                        withAnimation(Springs.cinematic) {
                            store.focusId = id
                            flyToNode(id)
                        }
                    },
                    onClose: {
                        withAnimation(Springs.standard) { showSearch = false }
                    }
                )
            }
        }
        .preferredColorScheme(.dark)
        .background(Color.black)
        .task {
            let seed = SeedData.generate()
            store.setGraph(nodes: seed.nodes, edges: seed.edges)
            let l = ForceLayout(store: store)
            l.start()
            layout = l
        }
        .onDisappear {
            layout?.stop()
        }
    }

    // MARK: - Interaction

    private func handleTap(worldX: Double, worldY: Double) {
        if let id = store.hitTest(worldX: worldX, worldY: worldY) {
            impact(.light)
            withAnimation(Springs.cinematic) {
                store.focusId = id
                flyToWorld(x: worldX, y: worldY)
            }
        } else if store.focusId != nil {
            impact(.selection)
            withAnimation(Springs.cinematic) { store.focusId = nil }
        }
    }

    private func flyToNode(_ id: String) {
        guard let i = store.nodeIndex[id],
              store.positions.indices.contains(i * 2 + 1) else { return }
        let x = store.positions[i * 2]
        let y = store.positions[i * 2 + 1]
        flyToWorld(x: x, y: y)
    }

    private func flyToWorld(x: Double, y: Double) {
        camera.tx = -x * camera.scale
        camera.ty = -y * camera.scale - 80   // leave room for the bottom sheet
        camera.scale = max(camera.scale, 1.2)
    }

    // MARK: - Haptics

    private enum Impact { case light, selection }

    private func impact(_ kind: Impact) {
        #if canImport(UIKit)
        switch kind {
        case .light:
            let g = UIImpactFeedbackGenerator(style: .light)
            g.impactOccurred()
        case .selection:
            let g = UISelectionFeedbackGenerator()
            g.selectionChanged()
        }
        #endif
    }
}
