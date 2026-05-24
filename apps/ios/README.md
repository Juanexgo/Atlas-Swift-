# Atlas — iOS native (SwiftUI)

The native Swift iOS version of Atlas. Same spatial knowledge graph,
same palette, same focus card structure — rebuilt against the Apple
platform with SwiftUI Canvas, `UltraThinMaterial`, and CADisplayLink
for the force layout.

| Layer | Implementation |
|---|---|
| **Renderer** | SwiftUI Canvas with imperative path drawing + blur filters for the glow |
| **Layout** | Custom force simulation in `ForceLayout.swift` — equivalent of `d3-force`. Ticks on CADisplayLink (auto-syncs to display refresh, so it hits 120Hz on ProMotion). |
| **State** | `GraphStore: ObservableObject` with positions held outside `@Published` for tick performance (same trick the web Float32Array uses). |
| **Glass** | Native `Material.ultraThin` instead of CSS `backdrop-filter` |
| **Haptics** | `UIImpactFeedbackGenerator` on tap-to-focus, selection on dismiss |
| **AI** | Async/await `URLSession` against the same Atlas API (`/ai/summarize/:id`). Reads `ATLAS_API_URL` from Info.plist. |

## Quick start (Xcode 16+)

The project is described as an [XcodeGen](https://github.com/yonaskolb/XcodeGen)
spec — `project.yml`. That gives a clean diff for the project file
without checking in the giant `.pbxproj` blob.

```bash
brew install xcodegen
cd apps/ios
xcodegen generate
open Atlas.xcodeproj
```

Press ⌘R. App boots on the iOS simulator or your connected device.

If you don't want to install XcodeGen, you can also:

1. Open Xcode → File → New → Project → App
2. Set Product Name = `Atlas`, Interface = SwiftUI, Language = Swift
3. Delete the default `ContentView.swift` and the generated `Assets.xcassets`
4. Drag `Atlas/` from this folder into the project (check "Copy items if needed")
5. Build & run

## Connecting to the API

By default Atlas iOS hits `http://localhost:4001`. To point at a deployed
API, edit `Atlas/Resources/Info.plist`:

```xml
<key>ATLAS_API_URL</key>
<string>https://atlas-api.your-domain.com</string>
```

If the API is unreachable, the focus sheet falls back to an offline
summary that names the node's neighbors — same behaviour as web and RN.

## Performance notes

- **120Hz** on iPhone 13 Pro and newer. `CADisableMinimumFrameDurationOnPhone`
  is set in Info.plist to unlock the full refresh rate; `CADisplayLink`
  drives the simulation at the display's native rate.
- **Allocation-free tick.** The force loop mutates `store.positions`
  in place — no temporary arrays inside the hot loop.
- **No re-renders per tick.** Views observe `store.tick` (an Int) for
  repaint; positions live outside `@Published` so the Combine pipeline
  stays quiet.

## Project structure

```
apps/ios/
├── project.yml                          # XcodeGen spec
├── Atlas/
│   ├── App/
│   │   ├── AtlasApp.swift               # @main entry
│   │   └── AtlasShell.swift             # root composer
│   ├── Models/
│   │   ├── AtlasNode.swift
│   │   ├── AtlasEdge.swift
│   │   └── GraphStore.swift             # ObservableObject
│   ├── Layout/
│   │   └── ForceLayout.swift            # d3-equivalent in Swift
│   ├── Views/
│   │   ├── Background.swift             # starfield + gradient
│   │   ├── GraphCanvas.swift            # Canvas renderer
│   │   ├── HUD.swift                    # top + bottom chrome
│   │   ├── FocusSheet.swift             # bottom sheet on focus
│   │   └── CommandSheet.swift           # search palette
│   ├── Theme/
│   │   ├── AtlasColors.swift            # palette (hex-identical to web)
│   │   └── Springs.swift                # named animation presets
│   ├── API/
│   │   └── AtlasAPI.swift               # async URLSession client
│   ├── Seed/
│   │   └── SeedData.swift               # demo graph
│   └── Resources/
│       ├── Info.plist
│       └── Assets.xcassets/
└── README.md
```

## Why both RN and Swift?

`apps/mobile` (React Native) ships iOS + Android from one codebase, with
shared data layer and palette. `apps/ios` (this folder) is the native
Swift version — same product, Apple-platform-first, demonstrates that the
project doesn't have to be cross-platform to be cross-platform.

Pick whichever you'd open in production. For a knowledge tool with deep
device integration (Shortcuts, Spotlight, Widgets, Apple Watch
companion), the native Swift version is the future. For ship velocity
and Android coverage, RN.
