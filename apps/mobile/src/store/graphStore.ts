/**
 * Mobile graph store. Pure Zustand — same shape as web's engine store,
 * but trimmed: no camera projection (mobile camera lives in shared
 * Reanimated values), no LOD (mobile renders one tier).
 */
import { create } from 'zustand';
import type { AtlasEdge, AtlasNode } from '../types';

export interface RenderNode extends AtlasNode {
  /** Index into the positions array. */
  index: number;
  /** Radius in world units; derived from weight on insertion. */
  radius: number;
}

interface GraphState {
  nodes: RenderNode[];
  nodeIndex: Map<string, number>;
  edges: AtlasEdge[];

  hoverId: string | null;
  focusId: string | null;

  setGraph: (data: { nodes: AtlasNode[]; edges: AtlasEdge[] }) => void;
  setHover: (id: string | null) => void;
  setFocus: (id: string | null) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  nodeIndex: new Map(),
  edges: [],
  hoverId: null,
  focusId: null,

  setGraph: ({ nodes, edges }) => {
    const renderNodes: RenderNode[] = new Array(nodes.length);
    const index = new Map<string, number>();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      renderNodes[i] = {
        ...n,
        index: i,
        radius: 10 + Math.pow(n.weight, 0.65) * 16,
      };
      index.set(n.id, i);
    }
    // Filter dangling edges defensively.
    const valid: AtlasEdge[] = [];
    for (const e of edges) {
      if (index.has(e.source) && index.has(e.target)) valid.push(e);
    }
    set({ nodes: renderNodes, nodeIndex: index, edges: valid });
  },
  setHover: (id) => set({ hoverId: id }),
  setFocus: (id) => set({ focusId: id }),
}));
