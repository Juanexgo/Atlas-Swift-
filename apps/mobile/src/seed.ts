/**
 * Mobile seed — mirrors the web seed at apps/web/src/features/seed/seedGraph.ts.
 * Kept here (instead of imported) because mobile lives outside the
 * workspace. Re-sync occasionally; the shape is identical.
 */
import { type AtlasEdge, type AtlasNode, type NodeKind, makeId } from './types';

interface Spec {
  title: string;
  kind: NodeKind;
  cluster: string;
  weight?: number;
  tags?: string[];
}

const SPECS: Spec[] = [
  // Atlas
  { title: 'Atlas v0 — the spatial OS', kind: 'project', cluster: 'atlas', weight: 1, tags: ['flagship'] },
  { title: 'Hybrid: instanced WebGL + DOM focus card', kind: 'note', cluster: 'atlas', weight: 0.85 },
  { title: 'Force layout on a worker', kind: 'task', cluster: 'atlas', weight: 0.6 },
  { title: 'GPU picking for hit-testing', kind: 'task', cluster: 'atlas', weight: 0.55 },
  { title: 'Yjs as source of truth, React as projection', kind: 'note', cluster: 'atlas', weight: 0.8 },
  { title: 'Adaptive accent extracted from node', kind: 'idea', cluster: 'atlas', weight: 0.45 },
  { title: 'Command palette spec', kind: 'document', cluster: 'atlas', weight: 0.6 },

  // AI
  { title: 'AI relationship mapping', kind: 'project', cluster: 'ai', weight: 0.95, tags: ['ai'] },
  { title: 'HDBSCAN clusters → LLM labeling', kind: 'idea', cluster: 'ai', weight: 0.7 },
  { title: 'Semantic search query', kind: 'task', cluster: 'ai', weight: 0.5 },
  { title: 'Ollama local for offline', kind: 'note', cluster: 'ai', weight: 0.55 },

  // Mobile
  { title: 'Atlas Mobile — Expo + Skia', kind: 'project', cluster: 'mobile', weight: 0.75 },
  { title: 'Skia BlurMask for node glow', kind: 'task', cluster: 'mobile', weight: 0.55 },
  { title: 'Reanimated camera on UI thread', kind: 'task', cluster: 'mobile', weight: 0.5 },
  { title: 'iPad-first interaction', kind: 'idea', cluster: 'mobile', weight: 0.6 },

  // Sync
  { title: 'Realtime sync architecture', kind: 'project', cluster: 'sync', weight: 0.75 },
  { title: 'Yjs over WebSocket', kind: 'task', cluster: 'sync', weight: 0.55 },
  { title: 'Offline-first via IndexedDB', kind: 'note', cluster: 'sync', weight: 0.55 },

  // Inspiration
  { title: 'Apple HIG: spatial design principles', kind: 'link', cluster: 'insp', weight: 0.4 },
  { title: 'Arc Browser command bar', kind: 'document', cluster: 'insp', weight: 0.55 },
  { title: 'Linear graph view post-mortem', kind: 'document', cluster: 'insp', weight: 0.5 },
  { title: 'Visit to Figma offices', kind: 'memory', cluster: 'insp', weight: 0.4 },

  // Day-to-day
  { title: 'Daily standup', kind: 'note', cluster: 'today', weight: 0.3 },
  { title: 'Tomorrow: pair on shaders', kind: 'task', cluster: 'today', weight: 0.35 },
  { title: 'Chat with Jess about spatial Arc', kind: 'conversation', cluster: 'today', weight: 0.5 },
];

const CENTERS: Record<string, [number, number]> = {
  atlas: [0, 0],
  ai: [420, 180],
  mobile: [-440, -160],
  sync: [180, -380],
  insp: [-320, 360],
  today: [380, -340],
};

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

export function generateMobileSeed(): { nodes: AtlasNode[]; edges: AtlasEdge[] } {
  const rng = mulberry32(11);
  const now = Date.now();
  const nodes: AtlasNode[] = [];
  const byTitle = new Map<string, string>();

  for (const spec of SPECS) {
    const id = makeId('n');
    const c = CENTERS[spec.cluster] ?? [0, 0];
    const r = 50 + rng() * 200;
    const θ = rng() * Math.PI * 2;
    nodes.push({
      id,
      kind: spec.kind,
      title: spec.title,
      body: bodyFor(spec, rng),
      x: c[0] + Math.cos(θ) * r,
      y: c[1] + Math.sin(θ) * r,
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

  // Project → siblings within each cluster
  const byCluster: Record<string, AtlasNode[]> = {};
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const spec = SPECS[i]!;
    (byCluster[spec.cluster] ??= []).push(node);
  }
  for (const list of Object.values(byCluster)) {
    const project = list.find((n) => n.kind === 'project');
    if (!project) continue;
    for (const child of list) {
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

  // Cross-cluster semantic edges
  const cross: [string, string, number][] = [
    ['AI relationship mapping', 'Atlas v0 — the spatial OS', 0.8],
    ['Realtime sync architecture', 'Atlas v0 — the spatial OS', 0.7],
    ['Atlas Mobile — Expo + Skia', 'Atlas v0 — the spatial OS', 0.75],
    ['Yjs as source of truth, React as projection', 'Yjs over WebSocket', 0.85],
    ['Yjs as source of truth, React as projection', 'Offline-first via IndexedDB', 0.75],
    ['Arc Browser command bar', 'Command palette spec', 0.7],
    ['Linear graph view post-mortem', 'GPU picking for hit-testing', 0.6],
    ['Hybrid: instanced WebGL + DOM focus card', 'Skia BlurMask for node glow', 0.65],
  ];
  for (const [a, b, s] of cross) {
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

function bodyFor(_spec: Spec, rng: () => number): string {
  const filler = [
    'Quick capture; flesh out later.',
    'Three options under consideration. Decision by Friday.',
    'Reference for the spatial interaction model — pinned for re-read.',
    'Status: blocked on the camera anchor work.',
    'Top of mind — ties back to the v0 ship goal.',
    'Recurring theme in the design reviews.',
  ];
  return filler[Math.floor(rng() * filler.length)]!;
}
