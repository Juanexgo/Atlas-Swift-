/**
 * Engine store — projects external GraphInput into a render-ready shape and
 * exposes fine-grained selectors. Critically, *positions* are NOT in the
 * Zustand store. They live in a Float32Array owned by the InstancedNodes
 * component and mutated directly by the layout worker. Putting positions
 * in React state would cause hundreds of rerenders per second.
 *
 * What IS in the store:
 *   - Node metadata (id, title, kind, color, radius) — changes rarely
 *   - Edge list — changes rarely
 *   - Hover/focus/selection — UI state
 *   - Camera — read by overlays/HUD
 */
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { GraphInput, RenderEdge, RenderNode } from '../types';
import { NODE_KIND_ACCENT } from '@atlas/types';
import { color as colorTokens } from '@atlas/design-tokens';

interface GraphStoreState {
  nodes: RenderNode[];
  /** O(1) lookups */
  nodeIndex: Map<string, number>;
  edges: RenderEdge[];

  hoverId: string | null;
  focusId: string | null;

  camera: { x: number; y: number; zoom: number };

  /** Replaces the entire graph. Cheap — called on Yjs snapshot. */
  setGraph: (input: GraphInput) => void;
  setHover: (id: string | null) => void;
  setFocus: (id: string | null) => void;
  setCamera: (partial: Partial<{ x: number; y: number; zoom: number }>) => void;
}

const ACCENT_TO_HEX: Record<string, number> = {
  aurora: parseHex(colorTokens.accent.aurora),
  nebula: parseHex(colorTokens.accent.nebula),
  plasma: parseHex(colorTokens.accent.plasma),
  solar: parseHex(colorTokens.accent.solar),
  forest: parseHex(colorTokens.accent.forest),
  coral: parseHex(colorTokens.accent.coral),
  indigo: parseHex(colorTokens.accent.indigo),
};

function parseHex(s: string): number {
  return parseInt(s.replace('#', ''), 16);
}

function buildRenderNodes(input: GraphInput): {
  nodes: RenderNode[];
  index: Map<string, number>;
} {
  const nodes: RenderNode[] = new Array(input.nodes.length);
  const index = new Map<string, number>();
  for (let i = 0; i < input.nodes.length; i++) {
    const n = input.nodes[i]!;
    const accentName = NODE_KIND_ACCENT[n.kind];
    const color = ACCENT_TO_HEX[accentName] ?? ACCENT_TO_HEX.aurora!;
    nodes[i] = {
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      tags: n.tags,
      index: i,
      x: n.x,
      y: n.y,
      vx: 0,
      vy: 0,
      color,
      // Radius scales weight non-linearly so heavy nodes are noticeable but
      // light nodes don't disappear at low zoom.
      radius: 8 + Math.pow(n.weight, 0.65) * 18,
      weight: n.weight,
    };
    index.set(n.id, i);
  }
  return { nodes, index };
}

function buildRenderEdges(input: GraphInput, index: Map<string, number>): RenderEdge[] {
  // Drop dangling edges defensively
  const edges: RenderEdge[] = [];
  for (const e of input.edges) {
    if (!index.has(e.source) || !index.has(e.target)) continue;
    edges.push({ id: e.id, source: e.source, target: e.target, strength: e.strength });
  }
  return edges;
}

export const graphStore = createStore<GraphStoreState>((set) => ({
  nodes: [],
  nodeIndex: new Map(),
  edges: [],
  hoverId: null,
  focusId: null,
  camera: { x: 0, y: 0, zoom: 1 },

  setGraph: (input) => {
    const { nodes, index } = buildRenderNodes(input);
    const edges = buildRenderEdges(input, index);
    set({ nodes, nodeIndex: index, edges });
  },
  setHover: (id) => set({ hoverId: id }),
  setFocus: (id) => set({ focusId: id }),
  setCamera: (partial) => set((s) => ({ camera: { ...s.camera, ...partial } })),
}));

// React hook — selector style for cheap subscribes.
export function useGraph<T>(selector: (s: GraphStoreState) => T): T {
  return useStore(graphStore, selector);
}

/** Imperative read for non-React contexts (workers' callbacks, raf loops). */
export function readGraph(): GraphStoreState {
  return graphStore.getState();
}
