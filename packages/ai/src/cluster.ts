/**
 * Lightweight k-means++ over L2-normalized embeddings (spherical k-means).
 *
 * For the scale Atlas runs at (≤10k nodes), this converges in <100ms with
 * 20 iterations and gives clusters that map nicely to the knowledge-graph
 * intuition of "topics."
 *
 * Returns assignments + centroids; a downstream LLM call can label each
 * cluster from its members' titles.
 */
import { addInto, dot, normalize } from './vector';
import type { ClusterAssignment, Embedding } from './types';

interface ClusterOptions {
  k?: number;
  maxIters?: number;
  seed?: number;
  /** Stop when fewer than this many assignments change per iter. */
  convergeEps?: number;
}

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

/**
 * Pick an automatic k via a simple heuristic: sqrt(n/2), clamped to a
 * sensible range. Good default for knowledge graphs of 30–5000 nodes.
 */
export function suggestK(n: number): number {
  return Math.max(2, Math.min(16, Math.round(Math.sqrt(n / 2))));
}

export function kmeans(
  entries: { id: string; embedding: Embedding }[],
  options: ClusterOptions = {},
): ClusterAssignment {
  const n = entries.length;
  const empty: ClusterAssignment = {
    byNode: new Map(),
    byCluster: [],
    centroids: [],
  };
  if (n === 0) return empty;
  const dim = entries[0]!.embedding.dim;
  const k = Math.max(1, Math.min(options.k ?? suggestK(n), n));
  const rng = mulberry32(options.seed ?? 42);
  const maxIters = options.maxIters ?? 30;
  const convergeEps = options.convergeEps ?? Math.max(1, Math.floor(n * 0.005));

  const vectors = entries.map((e) => e.embedding.vector);

  /* ── k-means++ seeding: pick centers proportional to squared distance ──*/
  const centroids: Float32Array[] = [];
  centroids.push(copy(vectors[Math.floor(rng() * n)]!));
  const distSq = new Float32Array(n);
  for (let c = 1; c < k; c++) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      let nearest = Infinity;
      for (const cen of centroids) {
        const d = 1 - dot(cen, vectors[i]!); // cosine distance
        if (d < nearest) nearest = d;
      }
      distSq[i] = nearest * nearest;
      total += distSq[i]!;
    }
    let r = rng() * total;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      r -= distSq[i]!;
      if (r <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push(copy(vectors[chosen]!));
  }

  /* ── Lloyd iterations ──────────────────────────────────────────────── */
  const assign = new Int32Array(n);
  for (let iter = 0; iter < maxIters; iter++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < k; c++) {
        const s = dot(centroids[c]!, vectors[i]!);
        if (s > bestSim) {
          bestSim = s;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed++;
      }
    }
    // Recompute centroids as L2-normalized mean of cluster members.
    const next: Float32Array[] = Array.from({ length: k }, () => new Float32Array(dim));
    const counts = new Int32Array(k);
    for (let i = 0; i < n; i++) {
      addInto(next[assign[i]!]!, vectors[i]!);
      counts[assign[i]!]!++;
    }
    for (let c = 0; c < k; c++) {
      if (counts[c]! === 0) {
        // Empty cluster — reseed to a random vector to keep k stable.
        centroids[c] = copy(vectors[Math.floor(rng() * n)]!);
      } else {
        centroids[c] = normalize(next[c]!);
      }
    }
    if (changed <= convergeEps) break;
  }

  const byNode = new Map<string, number>();
  const byCluster: string[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) {
    const c = assign[i]!;
    byNode.set(entries[i]!.id, c);
    byCluster[c]!.push(entries[i]!.id);
  }
  return { byNode, byCluster, centroids };
}

function copy(v: Float32Array): Float32Array {
  const out = new Float32Array(v.length);
  out.set(v);
  return out;
}
