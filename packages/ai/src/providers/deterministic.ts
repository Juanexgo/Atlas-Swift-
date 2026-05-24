/**
 * Deterministic embedding provider — works fully offline.
 *
 * For each input we tokenize, hash each token to multiple feature
 * positions in a 256-dim vector (FNV-1a + linear probing → cheap
 * hashed-bag-of-words). Vectors are L2-normalized so cosine === dot.
 *
 * Properties:
 *   - Deterministic: same input → same vector. Forever.
 *   - Stable similarity: documents sharing tokens land close.
 *   - Zero deps, zero network.
 *
 * This is NOT semantic understanding — it's a stable baseline that lets
 * the entire AI surface (search, clustering, suggestions, summaries)
 * work end-to-end without a paid API key. Swap to a real model in prod
 * by changing one env var.
 */
import { normalize } from '../vector';
import type { Embedding, EmbeddingProvider } from '../types';

const DIM = 256;
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'at', 'by', 'is', 'are', 'was', 'be', 'as', 'it', 'this', 'that',
  'i', 'you', 'we', 'they', 'he', 'she', 'them', 'us', 'my', 'our',
  'from', 'into', 'than', 'so', 'do', 'did', 'has', 'have', 'had',
  'but', 'not', 'no', 'yes', 'if', 'then', 'else', 'just', 'about',
]);

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function tokenize(text: string): string[] {
  // Lowercase, split on non-word, drop short tokens and stopwords.
  const raw = text.toLowerCase().split(/[^a-z0-9]+/);
  const out: string[] = [];
  for (const t of raw) {
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

export function deterministicEmbed(text: string, dim: number = DIM): Float32Array {
  const v = new Float32Array(dim);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    // Map empty docs to a stable distinct vector (avoids divide-by-zero
    // and clustering all empties together with random other empties).
    v[0] = 1;
    return v;
  }
  // Bigram hashing too — gives short title-vs-title some signal.
  const tokenStream: string[] = [...tokens];
  for (let i = 0; i + 1 < tokens.length; i++) tokenStream.push(`${tokens[i]} ${tokens[i + 1]}`);

  for (const tok of tokenStream) {
    const h1 = fnv1a(tok);
    const h2 = fnv1a(`~${tok}`);
    const i1 = h1 % dim;
    const i2 = h2 % dim;
    // Sign-aware bucketing reduces collision damage.
    const s1 = (h1 & 1) === 0 ? 1 : -1;
    const s2 = (h2 & 1) === 0 ? 1 : -1;
    v[i1] = v[i1]! + s1;
    v[i2] = v[i2]! + s2;
  }
  return normalize(v);
}

export const deterministicProvider: EmbeddingProvider = {
  name: 'deterministic',
  version: 'v1',
  dim: DIM,
  async embed(texts: string[]): Promise<Embedding[]> {
    return texts.map((t) => ({
      vector: deterministicEmbed(t, DIM),
      dim: DIM,
      provider: 'deterministic',
      version: 'v1',
    }));
  },
};
