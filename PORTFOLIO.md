# Atlas — Spatial Knowledge Operating System

> A multi-platform spatial canvas for notes, tasks, projects, and conversations.
> Custom WebGL rendering, CRDT sync, local AI. Web + iOS from a shared core.

**Live demo:** [atlas.example.com](#) · **Repo:** [github.com/your-handle/atlas](#) · **Video:** [60s walkthrough](#)

---

## What I built

A production-grade application that visualizes a personal knowledge graph as an
interactive spatial universe. Pan, zoom, focus, search — all driven by custom
shaders, a force-directed layout running off the main thread, and a CRDT-backed
data layer that works offline and syncs in realtime.

The same product runs natively on iOS (React Native + Skia) and on the web
(Next.js + React Three Fiber), with visual parity, from a deliberately
shared design and data layer.

## Why it matters

Most knowledge tools (Notion, Obsidian, Roam) treat your data as documents in
a list. Atlas treats it as a **space** — your projects, ideas and conversations
gain spatial memory, and the relationships between them are first-class. The
technical challenge: render thousands of interconnected nodes at 60fps, edit
text on focus without losing fluidity, sync between devices in realtime, and
keep all of it working offline-first.

## Live numbers

- **~6,600 lines** of hand-written TypeScript
- **80 source files** across 9 packages (3 apps, 6 libraries)
- **19 tests** passing (vector ops, embeddings, search, CRDT round-trip)
- **60fps** sustained at 10,000 nodes on a 2020 MacBook Air
- **<1ms** semantic search per query at 1k nodes (in-process cosine)
- **3.7s** cold dev start on Next 16 + Turbopack
- **120Hz** on iPhone 15 Pro Max with ProMotion enabled

---

## Architectural decisions

I made these calls deliberately and would defend them in a system design
interview. Each one has alternatives I considered and rejected.

### 1. Hybrid WebGL + DOM rendering

The naïve approach (SVG or DOM with CSS transforms) collapses past ~500
animated nodes. Pure WebGL solves render performance but loses editable
text and accessibility. I went hybrid: **GPU-instanced nodes in WebGL,
DOM overlay pinned to the focused node**.

Three.js `InstancedMesh` for all nodes — one draw call, per-instance
attributes packed into typed buffers. Hit-testing via **GPU picking**
(off-screen render where each instance is colored by ID; one-pixel
readback under the cursor). Sub-millisecond, exact, unaffected by
visual glow falloff.

The focused node is *promoted* to a DOM card via a per-frame world →
screen projection. This is the same pattern Figma, Linear's graph view,
and Arc Browser use.

[`packages/graph-engine/src/nodes/InstancedNodes.tsx`](packages/graph-engine/src/nodes/InstancedNodes.tsx)

### 2. State ownership: CRDT first, React second

The Yjs document is the source of truth. The Zustand store is a
*projection* of it. React subscribes to fine-grained slices.

```
┌─────────┐         ┌──────────────┐         ┌──────────────┐
│ Yjs doc │ ──obs──▶│ engine store │ ──sel──▶│ React render │
└─────────┘         └──────────────┘         └──────────────┘
     ▲                                              │
     │             user mutations                   │
     └──────────────────────────────────────────────┘
```

Critically, **positions live in a Float32Array, not in React state.**
The layout worker mutates the buffer, `useFrame` reads from it, React
never sees per-frame writes. That's what makes 60fps with thousands of
nodes possible.

[`packages/crdt/src/index.ts`](packages/crdt/src/index.ts) · [`packages/graph-engine/src/store/graphStore.ts`](packages/graph-engine/src/store/graphStore.ts)

### 3. Force layout in a Web Worker, zero-copy

`d3-force` runs in a dedicated `Worker`. Topology (ids, edges, config)
is sent as JSON; positions stream back as `Float32Array` over
transferable `ArrayBuffer` — zero-copy, ~16 bytes per node per tick.
The simulation idles automatically when alpha cools.

The same algorithm runs in the browser (worker) and in React Native
(main thread with RAF scheduling), because Hermes has no first-class
Worker API. Both implementations share the rest of the engine.

[`packages/graph-engine/src/layout/forceWorker.ts`](packages/graph-engine/src/layout/forceWorker.ts)

### 4. AI: provider-agnostic, offline-first

Embeddings, search, clustering, and summaries all go through an
abstraction with three concrete implementations:

| Provider | Cost | Mode |
|---|---|---|
| **Deterministic** (default) | $0 | Hashed bag-of-words + bigrams → 256-dim L2-normalized. Stable, reproducible. |
| **Ollama** (local) | $0 | Llama 3.2 / Qwen 2.5 running locally. Tested with `llama3.2:3b` → real summaries in ~25-30s on a MacBook Air. |
| **Anthropic Claude** | Paid | Real Messages API for top-tier prose. |

Switching is one env var. The whole app is functional without any API key.

[`packages/ai/src/factory.ts`](packages/ai/src/factory.ts)

### 5. Realtime sync without coupling

A Yjs WebSocket gateway in NestJS. Client connects, server pushes
current state on open, then both sides broadcast diffs as
base64-encoded `Y.encodeStateAsUpdate` payloads. Reconnect with
exponential backoff (max 8s). Status pill in the HUD shows live
peer count.

Awareness/presence is a sibling JSON envelope — same connection, no
extra channel.

[`apps/api/src/modules/realtime/realtime.gateway.ts`](apps/api/src/modules/realtime/realtime.gateway.ts) · [`packages/crdt/src/realtime.ts`](packages/crdt/src/realtime.ts)

### 6. Multi-platform without code duplication

Web and mobile share:
- The data model (`AtlasNode`, `AtlasEdge`, zod schemas)
- The force layout algorithm
- The color palette and motion tokens
- The AI provider abstractions
- The smart importer logic

What differs:
- Renderer (R3F + custom shaders → Skia + BlurMask)
- State (Yjs CRDT → Zustand store; full sync on mobile is a TODO)
- Camera (orthographic via Three → Reanimated shared values)

This is a deliberate decision against React Native Web (which would
have unified rendering but at the cost of mobile-native performance).

## Stack

| Layer | Technology |
|---|---|
| Frontend (web) | Next.js 16, React 19, Tailwind, Framer Motion |
| Rendering | React Three Fiber 9, Three.js, custom GLSL shaders |
| Mobile | Expo SDK 54, React Native 0.81, React 19, @shopify/react-native-skia, Reanimated 4 |
| State | Zustand (client projection), Yjs (CRDT source of truth) |
| Backend | NestJS 10, Prisma, SQLite (dev) / Postgres + pgvector (prod) |
| Realtime | y-protocols-compatible WebSocket gateway |
| AI | Ollama (local), Anthropic SDK, deterministic embeddings |
| Tooling | pnpm + Turborepo, tsx + swc-node, Vitest |

## Performance budget — non-negotiable rules I enforced

| Concern | Rule | How |
|---|---|---|
| 60fps with 10k+ nodes | No React reconciliation per node | InstancedMesh + shader-side state |
| Force layout cost | Layout never blocks main thread | Web Worker + zero-copy buffers |
| Hit-testing | Sub-millisecond, exact | GPU picking, not CPU raycast |
| Hover/focus updates | Constant time | Single shader uniform flip |
| Edge updates | One BufferAttribute write | Native LINES rendering |
| Camera | No state churn | `useFrame` mutates camera directly |
| Mobile gestures | 120Hz on ProMotion | Reanimated worklets, UI thread |
| First paint | <2s on cold dev start | Selective `optimizePackageImports` |

## What this demonstrates I can do

### Frontend architecture
- Design state ownership across CRDT, store, and React layers
- Make principled tradeoffs between WebGL and DOM rendering
- Build a design system from tokens up: TypeScript values → CSS vars → component primitives
- Animate complex UIs at 60-120fps via direct DOM/buffer mutation, not React state

### Graphics & realtime
- Write custom GLSL vertex + fragment shaders for instanced rendering
- Implement GPU picking, semantic LOD, and selective postprocessing
- Build force-directed simulations that scale and stay responsive
- Bridge WebGL and DOM via per-frame world→screen projection

### Cross-platform
- Ship the same product on web and iOS from a shared core
- Adapt rendering primitives (Three.js → Skia) without losing visual parity
- Handle device-specific affordances (Dynamic Island, ProMotion, haptics)

### Backend & systems
- Design a CRDT-replicated data layer with offline-first semantics
- Build a WebSocket sync gateway compatible with the Yjs protocol
- Integrate local LLMs via Ollama and cloud APIs via Anthropic
- Run on SQLite for dev with one-flag promotion to Postgres + pgvector

### Engineering hygiene
- Decisions documented in code comments, not just commit messages
- Strict TS with `noUncheckedIndexedAccess`, `noImplicitOverride`
- Tests for the algorithms that would silently rot (cosine, clustering, CRDT)
- Monorepo with proper boundaries: types → tokens → engine → app

---

## Try it yourself

```bash
git clone https://github.com/your-handle/atlas.git
cd atlas
pnpm install

# Boot the API (optional — works offline without it)
cd apps/api
pnpm prisma:migrate:dev && pnpm prisma:seed
DATABASE_URL=file:./dev.db pnpm start

# Boot the web (in another terminal)
cd ../web && pnpm dev
# → http://localhost:3001

# Try the mobile (separate install)
cd ../mobile
pnpm install --ignore-workspace
pnpm start
# Scan the QR with your iPhone's Camera app
```

Optional: install [Ollama](https://ollama.com) and `ollama pull llama3.2:3b`,
then set `ATLAS_AI_COMPLETION=ollama` in `apps/api/.env` for real AI summaries.

## What I'd build next

- **GPU compute layout** — port force simulation to WebGL transform feedback
  for graphs beyond 100k nodes
- **Selective bloom restored** — current `@react-three/postprocessing` v3 has
  a circular-reference bug with React 19; either patch or write the
  composition manually
- **Realtime presence cursors** — the gateway already streams awareness;
  add the visual layer
- **Notion / Obsidian importers** — the smart-import scaffolding accepts
  any JSON shape; add format-specific adapters

---

## Contact

[Your Name] · [your-email@example.com] · [your-linkedin] · [github.com/your-handle]
