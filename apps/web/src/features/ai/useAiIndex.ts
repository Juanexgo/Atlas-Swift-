'use client';

/**
 * Client-side AI index. We compute embeddings in the browser with the
 * deterministic provider (zero deps, zero network) so search, similarity,
 * and relationship suggestions work fully offline.
 *
 * When the API server is running, we'd swap this for a fetch against
 * /ai/search — same shape, real model. The interface below stays the
 * same.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SearchIndex,
  deterministicEmbed,
  suggestRelationships,
  type RelationshipSuggestion,
  type SemanticHit,
} from '@atlas/ai';
import { useGraph } from '@atlas/graph-engine';

interface AiIndex {
  /** Full-text + semantic search hits, descending score. */
  search: (q: string, k?: number) => SemanticHit[];
  /** Top-k similar nodes to a given node id. */
  similar: (id: string, k?: number) => SemanticHit[];
  /** Computed once per index build — suggested cross-cluster relationships. */
  suggestions: RelationshipSuggestion[];
  /** True after first build. */
  ready: boolean;
}

export function useAiIndex(): AiIndex {
  const nodes = useGraph((s) => s.nodes);
  const edges = useGraph((s) => s.edges);
  const [ready, setReady] = useState(false);
  const indexRef = useRef<SearchIndex>(new SearchIndex());
  const [suggestions, setSuggestions] = useState<RelationshipSuggestion[]>([]);

  // Build / rebuild index whenever the node set changes. Cheap enough
  // (hash bag-of-words) to do synchronously, but we wrap in a microtask
  // to keep the first paint fast.
  useEffect(() => {
    if (nodes.length === 0) {
      indexRef.current.build([]);
      setSuggestions([]);
      setReady(true);
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const entries = nodes.map((n) => ({
        id: n.id,
        embedding: {
          vector: deterministicEmbed(`${n.title}\n${n.body}\n${n.tags.join(' ')}`),
          dim: 256,
          provider: 'deterministic',
          version: 'v1',
        },
      }));
      indexRef.current.build(entries);
      const atlasEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        kind: 'link' as const,
        strength: e.strength,
        createdAt: 0,
      }));
      const sug = suggestRelationships(entries, atlasEdges, {
        perNode: 3,
        minScore: 0.82,
      }).slice(0, 24);
      setSuggestions(sug);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [nodes, edges]);

  return useMemo<AiIndex>(
    () => ({
      ready,
      search: (q, k = 8) => {
        if (!q.trim() || !ready) return [];
        return indexRef.current.search(deterministicEmbed(q), k, 0.55);
      },
      similar: (id, k = 5) => indexRef.current.similarTo(id, k),
      suggestions,
    }),
    [ready, suggestions],
  );
}
