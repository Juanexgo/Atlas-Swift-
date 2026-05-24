# Atlas — Video Walkthrough (60–90s)

The video is the single most important piece of your portfolio. Recruiters
will skim the README; they will *watch* a 60s video if the first 3 seconds
hook them.

## Recording setup

- **Tool:** QuickTime Player (built into macOS) → File → New Screen Recording.
  Capture the Atlas canvas in a window at **1920×1080** or larger.
- **Audio:** Record voiceover separately in QuickTime (File → New Audio
  Recording) so you can re-do takes. Edit together in iMovie.
- **Music:** Optional. If used, something atmospheric and quiet — e.g.
  Brian Eno style ambient. Mute it under voice.
- **Length:** 60–75 seconds. Past 90s you lose attention.
- **Resolution:** Export at 1080p, H.264, ~10 Mbps. Upload to YouTube
  (unlisted) and Loom — both links go on your portfolio.

## Pre-recording checklist

- Atlas web running on `localhost:3001`
- API + Ollama running, so the AI summary demo is real
- Browser at full-screen, no bookmarks bar visible
- All test/dev panels closed
- Open DevTools, set network throttling to "No throttling" (defaults sometimes throttle)
- Set the camera to a nice angle on a project node (so the first frame is interesting)
- Recent macOS dark mode

---

## The script (timecoded)

### [0:00–0:05] Hook
> "This is Atlas. It turns your knowledge into a spatial universe."

**Visual:** Cold open on the constellation, slow zoom out. Show ~30 nodes,
edges glowing, atmosphere visible. No UI chrome visible yet — pure scene.

### [0:05–0:15] What it is
> "Notes, ideas, projects — every entity is a node, every relationship is
> an edge. The whole graph runs on custom WebGL shaders with a worker-driven
> force layout."

**Visual:** Pan across the constellation, then pinch zoom in. Demonstrate
the fluidity — no jank.

### [0:15–0:25] Click into a node → focus mode
> "Tap any node. The camera flies in, the rest of the graph dims, and a
> glass card materializes pinned to the node in world space."

**Visual:** Click a `project` node (e.g. "AI relationship mapping"). Show
the camera flight, the dim, the card sliding in.

### [0:25–0:35] AI in action
> "Press S to summarize. A local Llama model running in Ollama generates a
> real summary that considers the node's neighbors. Zero API cost, zero
> internet."

**Visual:** Hit `S`. Wait for the summary to appear (~25s — *cut to it
appearing, don't show the full wait*). Show the prose. Highlight that
it referenced connected nodes.

### [0:35–0:45] Command palette + semantic search
> "Command-K opens the spine of the app. Search is semantic — embeddings
> rank results by meaning, not just substring match."

**Visual:** ⌘K, type "rendering". Show the "Semantic results" group with
% match scores. Pick one, camera flies to it.

### [0:45–0:55] Multi-tab realtime
> "Open another tab. The CRDT layer keeps both in sync over WebSocket — and
> the same data layer survives offline via IndexedDB."

**Visual:** Open second tab side-by-side. Drag a node in tab 1; show it
move in tab 2 instantly. Cut network, drag again, show the disconnect
indicator, restore network, show reconnect.

### [0:55–1:05] Mobile (optional)
> "Same product on iOS. React Native with Skia for rendering, Reanimated
> for 120Hz gestures on ProMotion devices. The web and the mobile share
> the data layer, color palette, and layout algorithm."

**Visual:** Cut to a phone-shaped screen recording from your iPhone 15
Pro Max. Show pan, tap to focus, the bottom sheet with the same AI summary
button.

### [1:05–1:15] Closer
> "Atlas was 80 source files, 6.6k lines of TypeScript, three apps,
> six libraries. The README has the full architecture breakdown.
> Thanks for watching."

**Visual:** Cut to the README scrolling, then to your GitHub profile, then
to a final shot of the constellation. Hold on the constellation for 1s.

---

## Cuts to keep in the back pocket

If you want a 30s version for Twitter/LinkedIn:
- Hook (5s)
- Click + focus mode (8s)
- AI summary (5s, just the result)
- ⌘K semantic search (5s)
- Multi-tab sync (5s)
- Closer (2s)

If you want a 3-minute "deep dive" for senior IC interviews:
- Add the Architecture section with diagrams (you draw the hybrid WebGL/DOM
  diagram on Excalidraw, screenshot, voice over each decision)
- Show actual code: the InstancedMesh + shader, the worker protocol, the
  Yjs gateway
- Explain the *why* not just the *what*

---

## Things NOT to do

- ❌ Don't show errors, dev banners, or React DevTools panels
- ❌ Don't include music that fights your voice
- ❌ Don't speed up the AI summary clip — cut it
- ❌ Don't say "I think it's pretty cool" — say what it does
- ❌ Don't end with "thanks for watching" alone — end with how to find you

---

## Where to post

| Channel | Format |
|---|---|
| **Twitter/X** | 30s clip embedded, link to the 60s in replies |
| **LinkedIn** | 60s native upload + portfolio link |
| **YouTube unlisted** | Full 60s, link from portfolio + LinkedIn post |
| **Loom** | Same 60s — easier for "share this with the hiring manager" |
| **Your portfolio site** | Embedded YouTube + GIF preview for SSR cards |
| **Hacker News** | Show HN post with link to demo + repo (only if demo is deployed publicly) |

---

## After the video lands

Track in a spreadsheet:
- Who viewed (LinkedIn analytics, YouTube referrers)
- Who DM'd you
- Which post got engagement (so you can replicate)

The video is a multiplier — every conversation you have after it starts
with the recruiter or hiring manager *already impressed*, which changes
the whole tenor of the chat.
