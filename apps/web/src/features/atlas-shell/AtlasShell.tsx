'use client';

/**
 * AtlasShell — the page composition.
 *
 * Responsibilities:
 *   - Mount the Yjs ↔ engine bridge.
 *   - Render the WebGL canvas (dynamically imported, SSR-disabled).
 *   - Render the DOM layers: HUD, focus card, command palette.
 *   - Wire ⌘K and Escape globally.
 *
 * The shell stays thin — features it composes own their own state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CommandPalette, type CommandItem } from '@atlas/ui';
import { useGraph, graphStore, FocusOverlay, flyTo, type LayoutHandle } from '@atlas/graph-engine';
import type { Camera, OrthographicCamera } from 'three';
import { useGraphSync } from '@/features/crdt/useGraphSync';
import { useCameraPersistence } from '@/features/crdt/useCameraPersistence';
import { useRealtime } from '@/features/crdt/useRealtime';
import { useAiIndex } from '@/features/ai/useAiIndex';
import { HUD } from './HUD';
import { FocusCard } from './FocusCard';
import { Timeline } from '@/features/timeline/Timeline';
import { ProjectsPanel } from '@/features/projects/ProjectsPanel';
import { GraphCanvas } from './GraphCanvas';
import { useAtlasActions } from './useAtlasActions';
import { DropZone } from '@/features/import/DropZone';
import type { NodeKind } from '@atlas/types';

/**
 * Client-only WebGL mount. We deliberately do NOT use `next/dynamic` —
 * its `LoadableComponent` wrapper appears in the React 19 fiber tree, and
 * when R3F sets up its event system underneath, React's dev-time
 * introspection walks the wrapper's stored props (which include the
 * Three.js scene state) and chokes on the parent↔child cycles inherent
 * to Three's scene graph with a "cyclic object value" TypeError.
 *
 * A useEffect-gated mount keeps the canvas client-only without the
 * extra fiber layer.
 */
function ClientOnlyCanvas(props: {
  onLayout: (h: LayoutHandle | null) => void;
  onCamera: (c: Camera | null) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <LoadingVoid />;
  return <GraphCanvas onLayout={props.onLayout} onCamera={props.onCamera} />;
}

export function AtlasShell() {
  const { status } = useGraphSync();
  const realtime = useRealtime();
  const ai = useAiIndex();
  const actions = useAtlasActions();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // The canvas surfaces these refs to us so the focus overlay (which lives
  // in the DOM tree, not the R3F tree) can project world → screen.
  const layoutRef = useRef<LayoutHandle | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(0));

  // Keep positionsRef.current pointed at the current LayoutHandle's buffer.
  // (Buffer identity changes when the node set is resized.)
  const handleLayout = useCallback((h: LayoutHandle | null) => {
    layoutRef.current = h;
    if (h) positionsRef.current = h.positions;
  }, []);

  const handleCamera = useCallback((cam: Camera | null) => {
    cameraRef.current = cam;
  }, []);

  // Restore/save camera state across reloads.
  useCameraPersistence(cameraRef);

  // Global keybindings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape') {
        const focus = graphStore.getState().focusId;
        if (focus) {
          graphStore.getState().setFocus(null);
          return;
        }
      }
      if (inField) return;
      const key = e.key.toLowerCase();

      // S → AI summary of focused node
      if (!isMod && key === 's') {
        const focus = graphStore.getState().focusId;
        if (focus) {
          window.dispatchEvent(new CustomEvent('atlas:summarize', { detail: { id: focus } }));
        }
        return;
      }

      // J/K → navigate to neighbor of focused node (J=next, K=previous)
      if (!isMod && (key === 'j' || key === 'k')) {
        const state = graphStore.getState();
        const focus = state.focusId;
        if (!focus) return;
        const neighbors: string[] = [];
        for (const edge of state.edges) {
          if (edge.source === focus) neighbors.push(edge.target);
          else if (edge.target === focus) neighbors.push(edge.source);
        }
        if (neighbors.length === 0) return;
        // Cycle through neighbors in a stable order.
        const stash = (graphStore as unknown as { __navStash?: { id: string; idx: number } }).__navStash;
        let idx = 0;
        if (stash && stash.id === focus) {
          idx = key === 'j'
            ? (stash.idx + 1) % neighbors.length
            : (stash.idx - 1 + neighbors.length) % neighbors.length;
        } else {
          idx = key === 'j' ? 0 : neighbors.length - 1;
        }
        const nextId = neighbors[idx]!;
        (graphStore as unknown as { __navStash?: { id: string; idx: number } }).__navStash = {
          id: nextId,
          idx,
        };
        graphStore.getState().setFocus(nextId);
        return;
      }

      // N → quick capture: create a note via inline prompt
      if (!isMod && key === 'n') {
        const title = window.prompt('New note title');
        if (title && title.trim()) {
          actions.createNode('note', title.trim());
          showToast(`Created · ${title.trim()}`);
        }
        return;
      }

      // Backspace / Delete with focus → delete focused
      if (!isMod && (e.key === 'Backspace' || e.key === 'Delete')) {
        const focus = graphStore.getState().focusId;
        if (focus) {
          actions.deleteFocused();
          showToast('Deleted');
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, showToast]);

  const focusId = useGraph((s) => s.focusId);
  const nodes = useGraph((s) => s.nodes);
  const nodeIndex = useGraph((s) => s.nodeIndex);

  // When a node receives focus, fly the camera to it.
  useEffect(() => {
    if (!focusId) return;
    const idx = nodeIndex.get(focusId);
    const cam = cameraRef.current as OrthographicCamera | null;
    if (idx == null || !cam) return;
    const positions = positionsRef.current;
    const x = positions[idx * 2];
    const y = positions[idx * 2 + 1];
    if (x == null || y == null) return;
    flyTo(cam, { x, y, zoom: Math.max(1.3, cam.zoom) });
  }, [focusId, nodeIndex]);

  const paletteItems = useMemo<CommandItem[]>(() => {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Semantic hits go first when the user has typed something. We mark
    // them with a group; the palette will deduplicate by id.
    const hits = paletteQuery.trim().length > 1 ? ai.search(paletteQuery, 6) : [];
    const aiItems: CommandItem[] = [];
    for (const h of hits) {
      const n = nodeById.get(h.id);
      if (!n) continue;
      aiItems.push({
        id: `ai:${n.id}`,
        label: n.title,
        hint: `${capitalize(n.kind)} · ${(h.score * 100).toFixed(0)}% match`,
        group: 'Semantic results',
        keywords: [n.kind],
        onSelect: () => graphStore.getState().setFocus(n.id),
      });
    }

    const semanticIds = new Set(hits.map((h) => h.id));
    const nodeItems: CommandItem[] = nodes
      .filter((n) => !semanticIds.has(n.id))
      .map((n) => ({
        id: n.id,
        label: n.title,
        hint: capitalize(n.kind),
        group: 'Nodes',
        keywords: [n.kind, ...n.title.toLowerCase().split(/\s+/)],
        onSelect: () => graphStore.getState().setFocus(n.id),
      }));

    const kinds: NodeKind[] = ['note', 'idea', 'task', 'project', 'conversation', 'link', 'memory', 'document'];
    const createActions: CommandItem[] = kinds.map((k) => ({
      id: `create:${k}`,
      label: `Create ${k}`,
      hint: paletteQuery.trim().length > 1 ? `“${paletteQuery.trim()}”` : 'opens a quick-capture prompt',
      group: 'Create',
      keywords: ['new', 'create', 'capture', k],
      onSelect: () => {
        const seed = paletteQuery.trim();
        const title = seed.length > 1 ? seed : window.prompt(`New ${k} title`) ?? '';
        if (!title.trim()) return;
        actions.createNode(k, title.trim());
        showToast(`Created · ${title.trim()}`);
      },
    }));

    const viewActions: CommandItem[] = [
      {
        id: 'action:zoom-reset',
        label: 'Reset zoom',
        hint: 'Center the canvas',
        group: 'View',
        shortcut: ['⌘', '0'],
        onSelect: () => {
          const cam = cameraRef.current as OrthographicCamera | null;
          if (cam) flyTo(cam, { x: 0, y: 0, zoom: 1 });
        },
      },
      {
        id: 'action:clear-focus',
        label: 'Clear focus',
        hint: 'Return to overview',
        group: 'View',
        shortcut: ['esc'],
        onSelect: () => graphStore.getState().setFocus(null),
      },
      {
        id: 'action:toggle-projects',
        label: 'Toggle projects panel',
        group: 'View',
        shortcut: ['P'],
        onSelect: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })),
      },
    ];

    const dataActions: CommandItem[] = [
      {
        id: 'action:import-clipboard',
        label: 'Import JSON from clipboard',
        hint: 'Atlas snapshot or any structured JSON',
        group: 'Data',
        keywords: ['paste', 'import', 'load', 'json', 'smart'],
        onSelect: async () => {
          const r = await actions.importFromClipboard();
          showToast(formatImportToast(r));
        },
      },
      {
        id: 'action:import-file',
        label: 'Import JSON file…',
        hint: 'Opens a file picker',
        group: 'Data',
        keywords: ['file', 'upload', 'open'],
        onSelect: () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'application/json,.json';
          input.onchange = async () => {
            const f = input.files?.[0];
            if (!f) return;
            const r = await actions.importFromFile(f);
            showToast(formatImportToast(r));
          };
          input.click();
        },
      },
      {
        id: 'action:reset-all',
        label: 'Reset Atlas (delete everything)',
        hint: 'Danger zone',
        group: 'Data',
        keywords: ['wipe', 'clear', 'reset', 'delete'],
        onSelect: () => {
          actions.resetAll();
          showToast('Atlas cleared');
        },
      },
    ];

    return [...aiItems, ...createActions, ...viewActions, ...dataActions, ...nodeItems];
  }, [nodes, ai, paletteQuery, actions, showToast]);

  return (
    <div className="atlas-canvas-root">
      <div className="atlas-starfield" aria-hidden />
      <ClientOnlyCanvas onLayout={handleLayout} onCamera={handleCamera} />
      <HUD
        status={status}
        realtime={realtime.status}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <ProjectsPanel />
      <Timeline />

      <FocusOverlay positionsRef={positionsRef} cameraRef={cameraRef}>
        {(id) => (
          <AnimatePresence>
            {focusId === id && (
              <FocusCard nodeId={id} onClose={() => graphStore.getState().setFocus(null)} />
            )}
          </AnimatePresence>
        )}
      </FocusOverlay>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={paletteItems}
        placeholder="Jump to anything…"
        onQueryChange={setPaletteQuery}
      />

      <DropZone
        onDrop={async (file) => {
          const r = await actions.importFromFile(file);
          showToast(formatImportToast(r));
        }}
      />

      <Toast text={toast} />
    </div>
  );
}

function formatImportToast(r: {
  ok: boolean;
  reason?: string;
  count?: number;
  edgeCount?: number;
  source?: 'canonical' | 'smart';
}): string {
  if (!r.ok) return `Import failed — ${r.reason ?? 'unknown'}`;
  const suffix = r.source === 'smart' ? ' (smart mapped)' : '';
  const edgeBit = r.edgeCount != null ? ` · ${r.edgeCount} edges` : '';
  return `Imported ${r.count ?? 0} nodes${edgeBit}${suffix}`;
}

function Toast({ text }: { text: string | null }) {
  return (
    <AnimatePresence>
      {text && (
        <div
          className="pointer-events-none fixed bottom-32 left-1/2 z-[180] -translate-x-1/2"
          style={{
            animation: 'atlasToastIn 240ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div className="rounded-full border border-white/10 bg-black/70 px-4 py-2 text-[12.5px] font-medium text-white/85 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md">
            {text}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

function LoadingVoid() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="font-display text-[12px] uppercase tracking-[0.2em] text-white/30">
        composing graph…
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
