/**
 * AI-suggested relationship mapping.
 *
 * For each node, return its top-K nearest neighbors by embedding cosine.
 * Filter out pairs already connected by a graph edge. The result is a
 * suggestion list — UI presents these as "maybe related to" chips and
 * the user promotes them into real edges.
 */
import type { AtlasEdge } from '@atlas/types';
import type { Embedding, RelationshipSuggestion } from './types';
import { SearchIndex } from './search';

interface SuggestOptions {
  /** Suggestions per node. */
  perNode?: number;
  /** Filter out suggestions with score below this. */
  minScore?: number;
}

export function suggestRelationships(
  entries: { id: string; embedding: Embedding }[],
  existingEdges: AtlasEdge[],
  options: SuggestOptions = {},
): RelationshipSuggestion[] {
  const perNode = options.perNode ?? 3;
  const minScore = options.minScore ?? 0.78;
  const idx = new SearchIndex();
  idx.build(entries);

  // Build a Set of existing undirected pairs.
  const existing = new Set<string>();
  for (const e of existingEdges) {
    existing.add(pairKey(e.source, e.target));
  }

  // Dedup pairs across nodes too (a↔b and b↔a are the same).
  const emitted = new Set<string>();
  const out: RelationshipSuggestion[] = [];
  for (const { id } of entries) {
    const hits = idx.similarTo(id, perNode + 2);
    for (const h of hits) {
      if (h.score < minScore) continue;
      const key = pairKey(id, h.id);
      if (existing.has(key) || emitted.has(key)) continue;
      emitted.add(key);
      out.push({ source: id, target: h.id, score: h.score });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
