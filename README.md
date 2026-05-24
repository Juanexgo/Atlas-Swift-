# Atlas

A futuristic spatial knowledge operating system. Notes, ideas, tasks,
conversations, links, memories, projects, and documents rendered as a
living, interactive knowledge universe.

```
# Install everything (web + api + 7 packages — mobile installs separately)
pnpm install

# Boot the API (NestJS + SQLite + AI + realtime WebSocket gateway)
cd apps/api
pnpm prisma:migrate:dev        # creates dev.db
pnpm prisma:seed               # 17 nodes, 11 edges
DATABASE_URL=file:./dev.db PORT=4001 pnpm start

# Boot the web (Next.js 15 + R3F + spatial canvas)
cd apps/web && pnpm dev        # → http://localhost:3001

# Mobile (Expo + Skia) — separate install to avoid React 18 / 19 collision
cd apps/mobile && pnpm install && pnpm start
```

## Repo

```
atlas/
├── apps/
│   ├── web/                Next.js 15 (App Router, Turbopack, R3F v9)
│   ├── api/                NestJS modular monolith (graph, ai, realtime, health)
│   └── mobile/             Expo + RN Skia + Reanimated (standalone install)
├── packages/
│   ├── graph-engine/       R3F scene, force-layout worker, LOD, picking, bloom
│   ├── ai/                 Embeddings, semantic search, k-means, suggestions, summaries
│   ├── ui/                 Glass surface, command palette, Kbd, motion primitives
│   ├── design-tokens/      Color/space/motion/elevation as typed TS + CSS vars
│   ├── crdt/               Yjs + IndexedDB binding, typed graph accessors
│   └── types/              Zod schemas — single source of truth
└── turbo.json
```

## Architecture decisions

### Rendering — hybrid WebGL + DOM

| Layer       | What | Why |
|-------------|------|-----|
| WebGL (R3F) | Nodes + edges, postprocessing | GPU-instanced, 10k+ nodes, zero React reconciliation |
| DOM overlay | Focus card, HUD, command palette, timeline, projects panel | Editable text, a11y, semantic HTML |

The Figma/Linear/Arc pattern.

### State ownership

```
┌─────────┐         ┌──────────────┐         ┌──────────────┐
│ Yjs doc │ ──obs──▶│ engine store │ ──sel──▶│ React render │
└─────────┘         └──────────────┘         └──────────────┘
     ▲                                              │
     │             user mutations                   │
     └──────────────────────────────────────────────┘
```

- **Yjs** owns the graph (offline-first, CRDT, future realtime).
- **Zustand store** = projection of Yjs into render-ready shape.
  Positions live in a `Float32Array` written by the layout worker and
  read by `useFrame` — keeping them out of React state is what makes
  60fps possible at 10k+ nodes.
- **React** subscribes via fine-grained selectors.

### Force layout

`d3-force` runs in a dedicated Web Worker. Topology sent as JSON, positions
streamed as transferable `Float32Array` ArrayBuffers (zero-copy, ~16
bytes/node/tick). Idles when simulation cools.

### GPU picking

Off-screen `WebGLRenderTarget` where each instance is colored by its
packed index. Read one pixel under the cursor → decode → node id.
Sub-millisecond, exact.

### Postprocessing

Selective bloom on hover/focus state (the node shader writes high-intensity
color in the glow ring; the bloom pass picks that up). Subtle vignette,
zoom-driven chromatic aberration at the extremes — never intrusive at 1x.

### Camera

Orthographic. Spring-damped pan/zoom mutates `camera.position`/`camera.zoom`
directly each frame inside `useFrame`. No React state in the hot path.
Cursor-anchored zoom (Figma/Maps behavior).

### AI

Provider abstraction with three concrete adapters:

- **Deterministic embeddings** (default, offline, zero deps) — hashed
  bag-of-words + bigrams into 256-dim L2-normalized vectors. Reproducible.
- **Anthropic completions** — opt-in via `ANTHROPIC_API_KEY` for AI
  summaries and cluster labels. Real Messages API.
- **Echo completions** — offline fallback. Honest about being offline.

On top of providers: `SearchIndex` (O(n) cosine, fast for ≤10k nodes,
swap to HNSW later), k-means++ clusters with spherical centroids,
relationship suggestions filtered against existing edges, AI summaries
keyed to a node's neighborhood.

Used by:
- Web command palette → semantic search results (typed query → ranked hits)
- Focus card → "AI suggestions" + "Summarize with AI" (S key)
- API endpoints under `/ai/*`

### Backend

NestJS modular monolith:

| Module    | Routes |
|-----------|--------|
| `health`  | `GET /health` (liveness + DB) |
| `graph`   | `GET/POST/PATCH/DELETE /graph/nodes`, `/graph/edges` |
| `ai`      | `GET /ai/search`, `/ai/similar/:id`, `/ai/clusters`, `/ai/suggest`, `POST /ai/summarize/:id`, `POST /ai/reindex` |
| `realtime`| WebSocket gateway at `/realtime` — y-protocols-compatible binary sync + awareness over JSON envelopes |

Persistence: Prisma + SQLite by default (zero-config dev). Swap to
Postgres + pgvector by changing `DATABASE_URL` (`docker-compose.yml` ships
a `ankane/pgvector` setup ready to go).

Runtime: `@swc-node/register` (decorator metadata preserved for Nest DI,
on-the-fly ESM-to-CJS for workspace packages). `nest build` for prod.

### Realtime collab

The Yjs document on the client (offline-first via IndexedDB) speaks a
JSON envelope over WebSocket to the API's gateway. The server holds the
authoritative doc per `doc id` and snapshots to Postgres/SQLite every 15s.
Awareness/presence is a sibling envelope, no Yjs Awareness wire format
needed for our shape.

### Design system

Tokens are typed TS values + CSS variables. **Motion is named springs, not durations** — every transition has feel encoded in stiffness/damping:

| Spring     | When |
|------------|------|
| `snappy`   | Hover/press feedback |
| `standard` | Default UI transitions |
| `cinematic`| Camera flights, focus mode |
| `ambient`  | Background atmosphere |
| `inertia`  | Pan/scroll decay |

Glass surfaces use `backdrop-filter` with elevation-coupled blur/shadow
tokens. Accent color is derived per `NodeKind` and exposed as
`--atlas-adaptive-accent` inside the focus card.

## Performance budget

| Concern                      | Strategy |
|------------------------------|----------|
| 60fps with 10k nodes         | InstancedMesh + shader-side state, no React reconciliation |
| Force layout cost            | Web Worker, transferable Float32Array (zero-copy) |
| Hit-testing                  | GPU picking RT, 1px readback per RAF |
| Hover/focus state changes    | Single attribute write, no remount |
| Edge updates                 | Single BufferAttribute, native LINES draw |
| Bloom                        | Mipmapped, threshold-gated — skips dim pixels |
| Semantic search              | In-process cosine, <1ms per query at ≤1k nodes |
| Embeddings                   | Hashed bag-of-words; pure function, zero allocation per query |

## Tests

```
pnpm test
```

19 tests across `@atlas/ai` (16) and `@atlas/crdt` (3):
- vector ops (dot, normalize, mean) — unrolled fast path matches scalar
- deterministic embeddings — stability, unit length, similarity sensitivity
- SearchIndex — ranking, minScore filter, similarTo excludes self, upsert/remove
- k-means — bookkeeping invariants, seed reproducibility
- CRDT — upsert/read round-trip, bulkSeed integrity, patch preserves untouched fields + bumps updatedAt

## Keyboard

| Key | Action |
|-----|--------|
| `⌘K` / `Ctrl+K` | Open command palette (semantic + actions + nodes) |
| `Esc` | Close focus / palette |
| `S` | Summarize the focused node with AI |
| `P` | Toggle projects sidebar |
| `Space + drag` | Pan canvas |
| `⌘/Ctrl + wheel` | Zoom (or trackpad pinch) |
| `↑ ↓ ↵` | Navigate palette |

## Mobile

`apps/mobile` is a working Expo + Skia spatial canvas — pan/zoom via
Reanimated on the UI thread, tap-to-focus, glass focus sheet. Shares
`@atlas/types` from the workspace.

It's deliberately excluded from `pnpm-workspace.yaml` to avoid React
Native 0.76's React 18 colliding with the web's React 19. Install it
separately:

```bash
cd apps/mobile && pnpm install && pnpm start
```

When the Expo SDK lands React 19 support across the toolchain, it folds
back into the unified workspace.

## License

Private / unpublished.
