'use client';

/**
 * The DOM card that materializes at the focused node.
 *
 * Layers (top to bottom):
 *   - Kind chip + close
 *   - Title + body
 *   - Tags
 *   - AI suggestions (nodes the AI thinks should be connected)
 *   - AI summary (collapsed by default; press S or click to expand)
 *   - Connected nodes list
 *   - Footer with keyboard hints
 */
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Glass, Kbd } from '@atlas/ui';
import { useGraph, graphStore } from '@atlas/graph-engine';
import { NODE_KIND_ACCENT, type NodeKind } from '@atlas/types';
import { color as colorTokens } from '@atlas/design-tokens';
import { useAiIndex } from '@/features/ai/useAiIndex';

const KIND_LABEL: Record<NodeKind, string> = {
  note: 'Note',
  idea: 'Idea',
  task: 'Task',
  project: 'Project',
  conversation: 'Conversation',
  link: 'Link',
  memory: 'Memory',
  document: 'Document',
};

function accentHex(kind: NodeKind): string {
  const accentName = NODE_KIND_ACCENT[kind] as keyof typeof colorTokens.accent;
  return colorTokens.accent[accentName] ?? colorTokens.accent.aurora;
}

interface FocusCardProps {
  nodeId: string;
  onClose: () => void;
}

export function FocusCard({ nodeId, onClose }: FocusCardProps) {
  const node = useGraph((s) => s.nodes.find((n) => n.id === nodeId));
  const edges = useGraph((s) => s.edges);
  const nodes = useGraph((s) => s.nodes);
  const ai = useAiIndex();

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Listen for the global S key dispatched by AtlasShell.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ id: string }>;
      if (ce.detail?.id === nodeId) {
        void requestSummary();
      }
    };
    window.addEventListener('atlas:summarize', handler);
    return () => window.removeEventListener('atlas:summarize', handler);
    // requestSummary captures latest state via the closure ref pattern
    // through useCallback below — adding it as a dep would re-bind on every
    // change. We close over `nodeId` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const requestSummary = useCallback(async () => {
    if (!node) return;
    setSummaryOpen(true);
    if (summary) return;
    setSummaryLoading(true);
    try {
      // Try the API if it's reachable; otherwise produce an offline summary
      // from neighborhood content.
      const res = await fetch(`http://localhost:4001/ai/summarize/${node.id}`, {
        method: 'POST',
        signal: AbortSignal.timeout(2500),
      }).catch(() => null);
      if (res && res.ok) {
        const json = (await res.json()) as { summary: string };
        setSummary(json.summary);
      } else {
        setSummary(offlineSummary(node, nodes, edges));
      }
    } catch {
      setSummary(offlineSummary(node, nodes, edges));
    } finally {
      setSummaryLoading(false);
    }
  }, [node, nodes, edges, summary]);

  if (!node) return null;

  const accent = accentHex(node.kind);
  const neighbors = relatedNodes(nodeId, edges, nodes);
  const aiSimilar = ai
    .similar(node.id, 6)
    .filter((h) => !neighbors.some((n) => n.id === h.id))
    .slice(0, 4);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 1 }}
      style={
        {
          '--atlas-adaptive-accent': accent,
        } as React.CSSProperties
      }
      className="w-[380px]"
    >
      <Glass elevation="command" className="overflow-hidden">
        <div
          aria-hidden
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
        />
        <div className="px-5 pt-4 pb-3">
          <div className="mb-2 flex items-center justify-between">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em]"
              style={{
                color: accent,
                borderColor: `${accent}30`,
                backgroundColor: `${accent}12`,
              }}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}` }}
              />
              {KIND_LABEL[node.kind]}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close focus"
              className="-mr-1 flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="m3 3 6 6m-6 0 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <h2 className="font-display text-[18px] font-semibold leading-tight tracking-tight text-white/95">
            {node.title}
          </h2>
          {node.body && (
            <p className="mt-2 text-[13px] leading-relaxed text-white/60">{node.body}</p>
          )}
          {node.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {node.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-medium text-white/55"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={requestSummary}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white/95"
          >
            <SparkleGlyph />
            {summaryLoading ? 'Summarizing…' : summary ? 'Summary' : 'Summarize with AI'}
            <Kbd className="!h-[15px] !min-w-[15px] !px-1 !text-[9.5px]">S</Kbd>
          </button>

          <AnimatePresence>
            {summaryOpen && (summary || summaryLoading) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 32 }}
                className="overflow-hidden"
              >
                <p className="mt-3 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-[12.5px] leading-relaxed text-white/75">
                  {summary ?? '…'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {aiSimilar.length > 0 && (
          <div className="border-t border-white/[0.06] px-5 py-3">
            <div className="mb-2 flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/35">
              <SparkleGlyph />
              <span>AI suggestions</span>
            </div>
            <ul className="space-y-1">
              {aiSimilar.map((hit) => {
                const n = byId.get(hit.id);
                if (!n) return null;
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => graphStore.getState().setFocus(hit.id)}
                      className="group flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-[12.5px] text-white/75 transition-colors hover:bg-white/[0.04] hover:text-white/95"
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: accentHex(n.kind) }}
                      />
                      <span className="flex-1 truncate">{n.title}</span>
                      <span className="font-mono text-[10.5px] tabular-nums text-white/35 group-hover:text-white/55">
                        {(hit.score * 100).toFixed(0)}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {neighbors.length > 0 && (
          <div className="border-t border-white/[0.06] px-5 py-3">
            <div className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/35">
              Connected
            </div>
            <ul className="space-y-1">
              {neighbors.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => graphStore.getState().setFocus(n.id)}
                    className="group flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-[12.5px] text-white/75 transition-colors hover:bg-white/[0.04] hover:text-white/95"
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: accentHex(n.kind) }}
                    />
                    <span className="flex-1 truncate">{n.title}</span>
                    <span className="ml-auto text-[10.5px] text-white/30">{KIND_LABEL[n.kind]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-2 text-[11px] text-white/40">
          <span className="flex items-center gap-1.5">
            <Kbd>esc</Kbd> close
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>S</Kbd> summarize
          </span>
        </div>
      </Glass>
    </motion.div>
  );
}

function relatedNodes(
  nodeId: string,
  edges: { source: string; target: string }[],
  nodes: { id: string; title: string; kind: NodeKind }[],
) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: { id: string; title: string; kind: NodeKind }[] = [];
  for (const e of edges) {
    const otherId = e.source === nodeId ? e.target : e.target === nodeId ? e.source : null;
    if (!otherId) continue;
    const n = byId.get(otherId);
    if (n) out.push(n);
  }
  return out;
}

function offlineSummary(
  node: { title: string; kind: NodeKind; body: string; tags: string[] },
  nodes: { id: string; title: string }[],
  edges: { source: string; target: string }[],
): string {
  const _byId = new Map(nodes.map((n) => [n.id, n]));
  const neighbors: string[] = [];
  for (const e of edges) {
    if (e.source === node.title) neighbors.push(_byId.get(e.target)?.title ?? '');
    if (e.target === node.title) neighbors.push(_byId.get(e.source)?.title ?? '');
  }
  const parts: string[] = [];
  parts.push(`A ${node.kind} titled "${node.title}".`);
  if (node.body) parts.push(node.body.slice(0, 160));
  if (neighbors.length > 0) {
    parts.push(`Connected to: ${neighbors.filter(Boolean).slice(0, 3).join(', ')}.`);
  }
  parts.push('(Offline summary — connect ATLAS_AI_COMPLETION for AI prose.)');
  return parts.join(' ');
}

function SparkleGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M6 1.5v3M6 7.5v3M1.5 6h3M7.5 6h3M3 3l1.6 1.6M7.4 7.4 9 9M3 9l1.6-1.6M7.4 4.6 9 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
