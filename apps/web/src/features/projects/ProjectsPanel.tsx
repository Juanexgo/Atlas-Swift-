'use client';

/**
 * Left-side glass sidebar. Lists projects (nodes of kind 'project') with
 * their satellite counts. Click a project to focus the camera on it AND
 * toggle a filter that dims non-cluster nodes via the focus mechanism
 * (single GPU uniform — no per-node React work).
 *
 * Press `p` globally to toggle the panel. Press `esc` to close.
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Glass, Kbd, cn } from '@atlas/ui';
import { useGraph, graphStore } from '@atlas/graph-engine';
import { NODE_KIND_ACCENT } from '@atlas/types';
import { color as tokens } from '@atlas/design-tokens';

export function ProjectsPanel() {
  const [open, setOpen] = useState(true);
  const nodes = useGraph((s) => s.nodes);
  const edges = useGraph((s) => s.edges);
  const focusId = useGraph((s) => s.focusId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      }
      if (e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const projects = useMemo(() => {
    // Count outgoing connectivity per project node.
    const counts = new Map<string, number>();
    for (const e of edges) {
      counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
      counts.set(e.target, (counts.get(e.target) ?? 0) + 1);
    }
    return nodes
      .filter((n) => n.kind === 'project')
      .map((n) => ({ id: n.id, title: n.title, count: counts.get(n.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [nodes, edges]);

  // Kind tallies for the secondary section.
  const kindCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) m.set(n.kind, (m.get(n.kind) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [nodes]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          className="absolute left-6 top-1/2 z-30 -translate-y-1/2"
        >
          <Glass elevation="floating" className="w-[230px]">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/45">
                Projects
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Hide projects"
                className="-mr-1 flex h-6 w-6 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/80"
              >
                <Kbd>p</Kbd>
              </button>
            </div>
            <ul className="px-1.5 pb-2">
              {projects.length === 0 && (
                <li className="px-3 py-2 text-[12px] text-white/35">No projects yet.</li>
              )}
              {projects.map((p) => {
                const isActive = focusId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() =>
                        graphStore.getState().setFocus(isActive ? null : p.id)
                      }
                      className={cn(
                        'group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] font-medium transition-colors',
                        isActive
                          ? 'bg-white/[0.07] text-white/95'
                          : 'text-white/70 hover:bg-white/[0.04] hover:text-white/90',
                      )}
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            tokens.accent[
                              NODE_KIND_ACCENT.project as keyof typeof tokens.accent
                            ],
                          boxShadow: isActive
                            ? `0 0 6px ${tokens.accent[NODE_KIND_ACCENT.project as keyof typeof tokens.accent]}`
                            : 'none',
                        }}
                      />
                      <span className="flex-1 truncate">{p.title}</span>
                      <span className="font-mono text-[10.5px] tabular-nums text-white/30 group-hover:text-white/55">
                        {p.count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-white/[0.05] px-4 pb-3 pt-2.5">
              <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/35">
                By kind
              </div>
              <div className="flex flex-wrap gap-1.5">
                {kindCounts.map(([kind, count]) => {
                  const accent =
                    tokens.accent[
                      (NODE_KIND_ACCENT[kind as keyof typeof NODE_KIND_ACCENT] ??
                        'aurora') as keyof typeof tokens.accent
                    ];
                  return (
                    <span
                      key={kind}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium"
                      style={{
                        color: accent,
                        borderColor: `${accent}25`,
                        backgroundColor: `${accent}0c`,
                      }}
                    >
                      <span
                        aria-hidden
                        className="h-1 w-1 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                      {kind}
                      <span className="font-mono text-white/40">{count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </Glass>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
