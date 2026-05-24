/**
 * Force layout on the main JS thread.
 *
 * Web runs d3-force in a Web Worker; React Native has no first-class
 * Worker API on the main runtime (Hermes), so we tick d3-force directly
 * inside an effect with rAF-like scheduling. For ≤300 nodes this stays
 * comfortably above 30fps on a modern device.
 *
 * Positions are exposed as a Float32Array — the same buffer is mutated
 * each tick and read by SkiaScene via a Reanimated shared value handle.
 */
import { useEffect, useRef } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import type { AtlasEdge } from '../types';
import type { RenderNode } from '../store/graphStore';

interface WNode extends SimulationNodeDatum {
  id: string;
}
interface WLink extends SimulationLinkDatum<WNode> {
  source: string | WNode;
  target: string | WNode;
  strength: number;
}

export interface LayoutHandle {
  positions: Float32Array;
  pin: (id: string, x: number | null, y: number | null) => void;
}

export function useLayout(
  nodes: RenderNode[],
  edges: AtlasEdge[],
): LayoutHandle {
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const pinnedRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const simRef = useRef<Simulation<WNode, WLink> | null>(null);
  const wNodesRef = useRef<WNode[]>([]);

  useEffect(() => {
    if (nodes.length === 0) {
      positionsRef.current = new Float32Array(0);
      simRef.current?.stop();
      simRef.current = null;
      return;
    }
    // Allocate / migrate position buffer, preserving existing entries.
    const next = new Float32Array(nodes.length * 2);
    const prev = positionsRef.current;
    const wNodes: WNode[] = new Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      const prevX = prev.length >= (i + 1) * 2 ? prev[i * 2] : undefined;
      const prevY = prev.length >= (i + 1) * 2 ? prev[i * 2 + 1] : undefined;
      const x = prevX != null && Number.isFinite(prevX) ? prevX : n.x;
      const y = prevY != null && Number.isFinite(prevY) ? prevY : n.y;
      next[i * 2] = x;
      next[i * 2 + 1] = y;
      wNodes[i] = { id: n.id, x, y, vx: 0, vy: 0 };
    }
    positionsRef.current = next;
    wNodesRef.current = wNodes;

    const links: WLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      strength: e.strength,
    }));

    const sim = forceSimulation<WNode, WLink>(wNodes)
      .force('charge', forceManyBody<WNode>().strength(-180))
      .force(
        'link',
        forceLink<WNode, WLink>(links)
          .id((d: WNode) => d.id)
          .distance(70)
          .strength((l: WLink) => Math.max(0.1, l.strength) * 0.6),
      )
      .force('center', forceCenter(0, 0).strength(0.04))
      .force('collide', forceCollide<WNode>(22))
      .alphaDecay(0.018)
      .velocityDecay(0.32)
      .stop();

    simRef.current = sim;

    let raf = 0;
    const tick = () => {
      const cur = simRef.current;
      if (!cur) return;
      cur.tick(1);
      // Apply pins.
      const pins = pinnedRef.current;
      const ws = wNodesRef.current;
      const buf = positionsRef.current;
      for (let i = 0; i < ws.length; i++) {
        const w = ws[i]!;
        const pin = pins.get(w.id);
        if (pin) {
          w.x = pin.x;
          w.y = pin.y;
          w.vx = 0;
          w.vy = 0;
          w.fx = pin.x;
          w.fy = pin.y;
        } else {
          w.fx = undefined as unknown as null;
          w.fy = undefined as unknown as null;
        }
        buf[i * 2] = w.x ?? 0;
        buf[i * 2 + 1] = w.y ?? 0;
      }
      if (cur.alpha() < 0.02 && pins.size === 0) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      sim.stop();
    };
  }, [nodes, edges]);

  return {
    positions: positionsRef.current,
    pin: (id, x, y) => {
      if (x == null || y == null) pinnedRef.current.delete(id);
      else pinnedRef.current.set(id, { x, y });
      // Re-heat the simulation so the change propagates visually.
      simRef.current?.alpha(Math.max(simRef.current.alpha(), 0.3)).restart();
    },
  };
}
