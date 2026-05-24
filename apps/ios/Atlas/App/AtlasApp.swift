//
//  AtlasApp.swift
//  Atlas
//
//  SwiftUI entrypoint. iOS 17+, dark scheme enforced everywhere.
//

import SwiftUI

@main
struct AtlasApp: App {
    var body: some Scene {
        WindowGroup {
            AtlasShell()
                .preferredColorScheme(.dark)
                .statusBarHidden(false)
        }
    }
}
