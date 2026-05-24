//
//  Background.swift
//  Atlas
//
//  Deep void with a faint starfield. Same visual as the web's
//  .atlas-starfield + radial gradient — drawn here with SwiftUI Canvas
//  for cheapness (one draw call, no AppKit/UIKit blur dance).
//

import SwiftUI

struct AtlasBackground: View {
    // Deterministic star positions so the field is stable across launches.
    private let stars: [Star] = {
        var rng = SystemRandom(seed: 1337)
        return (0..<60).map { _ in
            Star(
                x: rng.next(),
                y: rng.next(),
                r: 0.4 + rng.next() * 1.2,
                o: 0.15 + rng.next() * 0.4
            )
        }
    }()

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(hex: 0x000000),
                    Color(hex: 0x02030A),
                    Color(hex: 0x000000),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            Canvas { context, size in
                for star in stars {
                    let rect = CGRect(
                        x: star.x * size.width - star.r,
                        y: star.y * size.height - star.r,
                        width: star.r * 2,
                        height: star.r * 2
                    )
                    context.fill(Path(ellipseIn: rect),
                                 with: .color(.white.opacity(star.o)))
                }
            }
            .blendMode(.screen)
            .opacity(0.45)
        }
        .ignoresSafeArea()
    }
}

private struct Star {
    let x: Double
    let y: Double
    let r: Double
    let o: Double
}

private struct SystemRandom {
    private var state: UInt32
    init(seed: UInt32) { self.state = seed }
    mutating func next() -> Double {
        state &*= 1664525
        state &+= 1013904223
        return Double(state) / Double(UInt32.max)
    }
}
