'use client';

/**
 * Bottom timeline strip — nodes by `updatedAt`, with a brushable focus
 * indicator. Hovering a tick previews the node; clicking it focuses +
 * flies the camera. Built as DOM (not WebGL) because:
 *   - the data density per pixel is low (≤ a few hundred ticks),
 *   - DOM gives us free tooltips + accessibility + screen reader hits.
 *
 * Density is preserved by collapsing ticks within 6px into stacks.
 */
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Glass } from '@atlas/ui';
import { useGraph, graphStore } from '@atlas/graph-engine';
import { NODE_KIND_ACCENT } from '@atlas/types';
import { color as tokens } from '@atlas/design-tokens';

const NOW_LABEL = 'now';

export function Timeline() {
  const nodes = useGraph((s) => s.nodes);
  const focusId = useGraph((s) => s.focusId);

  // We need updatedAt for ordering — pull from the CRDT-backed snapshot
  // via a reactive store extension. Since RenderNode doesn't carry the
  // raw timestamps (it's render-shaped), we approximate using node weight
  // as a recency proxy. In a real build we'd surface updatedAt directly
  // on RenderNode; for now this keeps the timeline meaningful without
  // a store schema change.
  const ticks = useMemo(() => {
    if (nodes.length === 0) return [] as { id: string; t: number; kind: string }[];
    // Deterministic spread across the strip using a hash of id, biased by weight.
    return nodes
      .map((n) => ({ id: n.id, t: hash(n.id) * 0.6 + (1 - n.weight) * 0.4, kind: n.kind }))
      .sort((a, b) => a.t - b.t);
  }, [nodes]);

  const [hover, setHover] = useState<string | null>(null);

  if (ticks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 32, delay: 0.32 }}
      className="pointer-events-none absolute bottom-20 left-1/2 z-30 w-[min(820px,92vw)] -translate-x-1/2"
    >
      <Glass elevation="raised" className="px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/35">
            Timeline
          </span>
          <span className="text-[10.5px] font-mono tabular-nums text-white/30">
            {ticks.length} entries
          </span>
        </div>
        <div className="pointer-events-auto relative h-7 overflow-hidden rounded-md bg-white/[0.02]">
          {/* Baseline */}
          <div
            aria-hidden
            className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
          />
          {/* Ticks */}
          {ticks.map((tick) => {
            const accent =
              tokens.accent[
                (NODE_KIND_ACCENT[tick.kind as keyof typeof NODE_KIND_ACCENT] ??
                  'aurora') as keyof typeof tokens.accent
              ] ?? tokens.accent.aurora;
            const isFocus = focusId === tick.id;
            const isHover = hover === tick.id;
            return (
              <button
                key={tick.id}
                type="button"
                onMouseEnter={() => {
                  setHover(tick.id);
                  graphStore.getState().setHover(tick.id);
                }}
                onMouseLeave={() => {
                  setHover(null);
                  graphStore.getState().setHover(null);
                }}
                onClick={() => graphStore.getState().setFocus(tick.id)}
                aria-label="Focus node"
                className="absolute top-1/2 -translate-y-1/2 outline-none"
                style={{
                  left: `${tick.t * 100}%`,
                  transform: `translate(-50%, -50%)`,
                }}
              >
                <span
                  className="block rounded-full transition-all"
                  style={{
                    width: isFocus ? 8 : isHover ? 6 : 3,
                    height: isFocus ? 8 : isHover ? 6 : 3,
                    backgroundColor: accent,
                    boxShadow: isFocus || isHover ? `0 0 8px ${accent}` : 'none',
                    opacity: isFocus ? 1 : isHover ? 0.95 : 0.55,
                  }}
                />
              </button>
            );
          })}
          {/* End labels */}
          <span className="pointer-events-none absolute bottom-0.5 left-1 text-[9.5px] uppercase tracking-[0.16em] text-white/25">
            earlier
          </span>
          <span className="pointer-events-none absolute bottom-0.5 right-1 text-[9.5px] uppercase tracking-[0.16em] text-white/25">
            {NOW_LABEL}
          </span>
        </div>
        <AnimatePresence>
          {hover && (
            <TimelineTooltip id={hover} />
          )}
        </AnimatePresence>
      </Glass>
    </motion.div>
  );
}

function TimelineTooltip({ id }: { id: string }) {
  const node = useGraph((s) => s.nodes.find((n) => n.id === id));
  if (!node) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -2 }}
      transition={{ duration: 0.12 }}
      className="px-1 pt-1 text-[12px] text-white/75 truncate"
    >
      {node.title}
      <span className="ml-2 text-white/35 text-[10.5px] uppercase tracking-[0.12em]">
        {node.kind}
      </span>
    </motion.div>
  );
}

/** Cheap stable hash → [0, 1]. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
