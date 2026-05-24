/**
 * Server-side seed generator. Kept separate from the web seed (which lives
 * in apps/web/src/features/seed) so the two sides can evolve
 * independently. The shape is identical so they could be unified later.
 *
 * We inline the type definitions and `makeId` here rather than importing
 * from @atlas/types because ts-node (CJS) can't require an ESM module.
 * The shape mirrors @atlas/types exactly.
 */
type NodeKind =
  | 'note'
  | 'idea'
  | 'task'
  | 'project'
  | 'conversation'
  | 'link'
  | 'memory'
  | 'document';

interface AtlasNode {
  id: string;
  kind: NodeKind;
  title: string;
  body: string;
  x: number;
  y: number;
  weight: number;
  status: 'active' | 'archived' | 'pinned';
  tags: string[];
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface AtlasEdge {
  id: string;
  source: string;
  target: string;
  kind: 'link' | 'derives' | 'tagged' | 'mentions' | 'semantic';
  strength: number;
  createdAt: number;
}

function makeId(prefix: 'n' | 'e' = 'n'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

interface Spec {
  title: string;
  kind: NodeKind;
  cluster: string;
  weight?: number;
  tags?: string[];
}

const SPECS: Spec[] = [
  { title: 'Atlas v0 — the spatial OS', kind: 'project', cluster: 'atlas', weight: 1 },
  { title: 'Hybrid: instanced WebGL + DOM focus card', kind: 'note', cluster: 'atlas', weight: 0.8 },
  { title: 'Force layout on a worker', kind: 'task', cluster: 'atlas', weight: 0.6 },
  { title: 'GPU picking for hit-testing', kind: 'task', cluster: 'atlas', weight: 0.55 },
  { title: 'Yjs as source of truth, React as projection', kind: 'note', cluster: 'atlas' },
  { title: 'Command palette spec', kind: 'document', cluster: 'atlas', weight: 0.5 },

  { title: 'AI relationship mapping', kind: 'project', cluster: 'ai', weight: 0.95 },
  { title: 'Semantic search query', kind: 'task', cluster: 'ai', weight: 0.5 },
  { title: 'HDBSCAN clusters → LLM labeling', kind: 'idea', cluster: 'ai', weight: 0.7 },
  { title: 'AI summary stream over WS', kind: 'task', cluster: 'ai', weight: 0.5 },

  { title: 'Realtime sync architecture', kind: 'project', cluster: 'sync', weight: 0.75 },
  { title: 'Yjs over WebSocket — y-websocket server', kind: 'task', cluster: 'sync', weight: 0.55 },
  { title: 'Offline-first via IndexedDB', kind: 'note', cluster: 'sync', weight: 0.55 },

  { title: 'Atlas Mobile — Expo + Skia adapter', kind: 'project', cluster: 'mobile', weight: 0.7 },
  { title: 'iPad-first interaction model', kind: 'idea', cluster: 'mobile', weight: 0.6 },

  { title: 'Apple HIG: spatial design principles', kind: 'link', cluster: 'insp', weight: 0.4 },
  { title: 'Arc Browser command bar — UX teardown', kind: 'document', cluster: 'insp', weight: 0.55 },
];

const CENTERS: Record<string, [number, number]> = {
  atlas: [0, 0],
  ai: [420, 180],
  sync: [180, -380],
  mobile: [-460, -100],
  insp: [-300, 380],
};

function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateApiSeed(): { nodes: AtlasNode[]; edges: AtlasEdge[] } {
  const r = rng(11);
  const now = Date.now();
  const nodes: AtlasNode[] = [];
  for (const s of SPECS) {
    const c = CENTERS[s.cluster] ?? [0, 0];
    const radius = 50 + r() * 200;
    const θ = r() * Math.PI * 2;
    nodes.push({
      id: makeId('n'),
      kind: s.kind,
      title: s.title,
      body: '',
      x: c[0] + Math.cos(θ) * radius,
      y: c[1] + Math.sin(θ) * radius,
      weight: s.weight ?? 0.4 + r() * 0.2,
      status: 'active',
      tags: s.tags ?? [],
      projectId: null,
      createdAt: now - Math.floor(r() * 1000 * 60 * 60 * 24 * 30),
      updatedAt: now - Math.floor(r() * 1000 * 60 * 60 * 24 * 7),
    });
  }
  const edges: AtlasEdge[] = [];
  // Project-to-cluster siblings.
  const byCluster: Record<string, AtlasNode[]> = {};
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    (byCluster[SPECS[i]!.cluster] ??= []).push(n);
  }
  for (const list of Object.values(byCluster)) {
    const proj = list.find((n) => n.kind === 'project');
    if (!proj) continue;
    for (const c of list) {
      if (c === proj) continue;
      edges.push({
        id: makeId('e'),
        source: proj.id,
        target: c.id,
        kind: 'link',
        strength: 0.5 + r() * 0.2,
        createdAt: now,
      });
    }
  }
  return { nodes, edges };
}
