/**
 * Seed data for first-run Atlas — generates a realistic knowledge graph
 * spanning notes, projects, tasks, ideas, conversations, etc.
 *
 * Generation is deterministic (seeded RNG) so the demo always looks the
 * same on first load and the layout converges similarly.
 *
 * The output passes through Yjs upsert on first run only; subsequent
 * loads read from IndexedDB.
 */
import { type AtlasEdge, type AtlasNode, type NodeKind, makeId } from '@atlas/types';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface SeedSpec {
  title: string;
  kind: NodeKind;
  tags?: string[];
  /** project group key — clusters layout. */
  cluster: string;
  weight?: number;
}

// Hand-curated knowledge graph spine. Atlas should *look* like someone's
// actual brain. We've sketched a Silicon Valley product-team graph:
const SEED_SPECS: SeedSpec[] = [
  // Project: Atlas itself
  { title: 'Atlas v0 — the spatial OS', kind: 'project', cluster: 'atlas', weight: 1, tags: ['flagship'] },
  { title: 'Decide rendering: WebGL vs canvas', kind: 'idea', cluster: 'atlas', weight: 0.7 },
  { title: 'Hybrid: instanced WebGL + DOM focus card', kind: 'note', cluster: 'atlas', weight: 0.85 },
  { title: 'Semantic LOD — three tiers', kind: 'idea', cluster: 'atlas', weight: 0.7 },
  { title: 'Force layout on a worker', kind: 'task', cluster: 'atlas', weight: 0.6 },
  { title: 'GPU picking for hit-testing', kind: 'task', cluster: 'atlas', weight: 0.55 },
  { title: 'Yjs as source of truth, React as projection', kind: 'note', cluster: 'atlas', weight: 0.8 },
  { title: 'Adaptive accent extracted from focused node', kind: 'idea', cluster: 'atlas', weight: 0.45 },
  { title: 'Command palette spec', kind: 'document', cluster: 'atlas', weight: 0.6 },
  { title: 'Apple Vision Pro reference frames', kind: 'memory', cluster: 'atlas', weight: 0.5 },
  { title: 'Chat with Jess — "make it feel like spatial Arc"', kind: 'conversation', cluster: 'atlas', weight: 0.5 },
  { title: 'Bookmarks: r3f drei examples', kind: 'link', cluster: 'atlas', weight: 0.3 },

  // Project: AI relationship mapping
  { title: 'AI relationship mapping', kind: 'project', cluster: 'ai', weight: 0.95, tags: ['ai'] },
  { title: 'Embeddings via Anthropic vs local', kind: 'idea', cluster: 'ai', weight: 0.65 },
  { title: 'pgvector vs dedicated vector DB', kind: 'note', cluster: 'ai', weight: 0.55 },
  { title: 'Semantic search query — cosine on title+body', kind: 'task', cluster: 'ai', weight: 0.5 },
  { title: 'HDBSCAN clusters → LLM labeling', kind: 'idea', cluster: 'ai', weight: 0.7 },
  { title: 'Cache embeddings on insert, not on render', kind: 'note', cluster: 'ai', weight: 0.4 },
  { title: 'AI summary stream — token-by-token over WS', kind: 'task', cluster: 'ai', weight: 0.5 },
  { title: 'Conversation: design partner Q4 review', kind: 'conversation', cluster: 'ai', weight: 0.6 },

  // Project: Mobile
  { title: 'Atlas Mobile — Expo + Skia adapter', kind: 'project', cluster: 'mobile', weight: 0.7 },
  { title: 'Skia rendering parity with WebGL nodes', kind: 'task', cluster: 'mobile', weight: 0.55 },
  { title: 'Reanimated camera gestures', kind: 'task', cluster: 'mobile', weight: 0.5 },
  { title: 'iPad-first interaction model', kind: 'idea', cluster: 'mobile', weight: 0.6 },

  // Project: Sync
  { title: 'Realtime sync architecture', kind: 'project', cluster: 'sync', weight: 0.75 },
  { title: 'Yjs over WebSocket — y-websocket server', kind: 'task', cluster: 'sync', weight: 0.55 },
  { title: 'Conflict-free presence (awareness)', kind: 'note', cluster: 'sync', weight: 0.5 },
  { title: 'Offline-first via IndexedDB', kind: 'note', cluster: 'sync', weight: 0.55 },
  { title: 'Postgres snapshot every N updates', kind: 'idea', cluster: 'sync', weight: 0.45 },

  // Cross-cutting memories
  { title: 'Visit to Figma offices, Jan 2024', kind: 'memory', cluster: 'inspiration', weight: 0.4 },
  { title: 'Reading: Bret Victor "Worrydream"', kind: 'memory', cluster: 'inspiration', weight: 0.35 },
  { title: 'Reading: "The Cathedral and the Bazaar"', kind: 'memory', cluster: 'inspiration', weight: 0.3 },
  { title: 'Apple HIG: spatial design principles', kind: 'link', cluster: 'inspiration', weight: 0.4 },
  { title: 'Arc Browser command bar — UX teardown', kind: 'document', cluster: 'inspiration', weight: 0.55 },
  { title: 'Linear graph view post-mortem', kind: 'document', cluster: 'inspiration', weight: 0.5 },

  // Day-to-day
  { title: 'Daily standup notes — Mon', kind: 'note', cluster: 'standup', weight: 0.25 },
  { title: 'Daily standup notes — Tue', kind: 'note', cluster: 'standup', weight: 0.25 },
  { title: 'Daily standup notes — Wed', kind: 'note', cluster: 'standup', weight: 0.25 },
  { title: 'Daily standup notes — Thu', kind: 'note', cluster: 'standup', weight: 0.25 },
  { title: 'Ship-ready checklist for v0', kind: 'task', cluster: 'standup', weight: 0.55 },
  { title: 'Eng hiring — staff frontend role', kind: 'task', cluster: 'standup', weight: 0.45 },
  { title: 'Tomorrow: pair on the camera spring', kind: 'task', cluster: 'standup', weight: 0.35 },
];

const CLUSTER_CENTERS: Record<string, [number, number]> = {
  atlas: [0, 0],
  ai: [520, 200],
  mobile: [-540, -120],
  sync: [220, -460],
  inspiration: [-360, 460],
  standup: [580, -380],
};

export function generateSeedGraph(seed: number = 7): { nodes: AtlasNode[]; edges: AtlasEdge[] } {
  const rng = mulberry32(seed);
  const now = Date.now();
  const nodes: AtlasNode[] = [];
  const byTitle = new Map<string, string>();

  for (const spec of SEED_SPECS) {
    const id = makeId('n');
    const center = CLUSTER_CENTERS[spec.cluster] ?? [0, 0];
    const r = 60 + rng() * 220;
    const θ = rng() * Math.PI * 2;
    nodes.push({
      id,
      kind: spec.kind,
      title: spec.title,
      body: bodyFor(spec, rng),
      x: center[0] + Math.cos(θ) * r,
      y: center[1] + Math.sin(θ) * r,
      weight: spec.weight ?? 0.4 + rng() * 0.2,
      status: 'active',
      tags: spec.tags ?? [],
      projectId: null,
      createdAt: now - Math.floor(rng() * 1000 * 60 * 60 * 24 * 30),
      updatedAt: now - Math.floor(rng() * 1000 * 60 * 60 * 24 * 7),
    });
    byTitle.set(spec.title, id);
  }

  const edges: AtlasEdge[] = [];

  // Project-to-child edges: every project pulls its cluster siblings.
  const byCluster: Record<string, AtlasNode[]> = {};
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const spec = SEED_SPECS[i]!;
    (byCluster[spec.cluster] ??= []).push(node);
  }
  for (const clusterNodes of Object.values(byCluster)) {
    const project = clusterNodes.find((n) => n.kind === 'project');
    if (!project) continue;
    for (const child of clusterNodes) {
      if (child === project) continue;
      edges.push({
        id: makeId('e'),
        source: project.id,
        target: child.id,
        kind: 'link',
        strength: 0.55 + rng() * 0.2,
        createdAt: now,
      });
    }
  }

  // A handful of cross-cluster semantic edges, hand-picked so the demo
  // actually looks like a connected graph (clusters aren't islands).
  const crossLinks: [string, string, number][] = [
    ['Hybrid: instanced WebGL + DOM focus card', 'Skia rendering parity with WebGL nodes', 0.6],
    ['AI relationship mapping', 'Atlas v0 — the spatial OS', 0.8],
    ['Realtime sync architecture', 'Atlas v0 — the spatial OS', 0.7],
    ['Yjs as source of truth, React as projection', 'Yjs over WebSocket — y-websocket server', 0.85],
    ['Yjs as source of truth, React as projection', 'Offline-first via IndexedDB', 0.75],
    ['Arc Browser command bar — UX teardown', 'Command palette spec', 0.7],
    ['Apple Vision Pro reference frames', 'Atlas v0 — the spatial OS', 0.5],
    ['Linear graph view post-mortem', 'GPU picking for hit-testing', 0.6],
    ['HDBSCAN clusters → LLM labeling', 'Semantic search query — cosine on title+body', 0.7],
    ['Ship-ready checklist for v0', 'Atlas v0 — the spatial OS', 0.65],
  ];
  for (const [a, b, s] of crossLinks) {
    const ida = byTitle.get(a);
    const idb = byTitle.get(b);
    if (!ida || !idb) continue;
    edges.push({
      id: makeId('e'),
      source: ida,
      target: idb,
      kind: 'semantic',
      strength: s,
      createdAt: now,
    });
  }

  return { nodes, edges };
}

function bodyFor(spec: SeedSpec, rng: () => number): string {
  // Just enough text per node to demo the focus card. Real bodies would
  // be Markdown.
  const filler = [
    'Quick capture; flesh out later.',
    'Three options under consideration. Need a decision by Friday.',
    'Reference for the spatial interaction model — pinned for re-read.',
    'Won the argument: the data model has to be CRDT-native or sync gets messy.',
    'Status: blocked on the camera anchor work.',
    'Top of mind — ties back to the v0 ship goal.',
  ];
  const idx = Math.floor(rng() * filler.length);
  return filler[idx]!;
}
