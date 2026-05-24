/**
 * Hook: spins up the force worker, feeds it the current graph, exposes a
 * Float32Array `positions` ref that updates in place on every tick.
 *
 * The positions buffer is shared by reference with the InstancedNodes
 * component — that component reads from it inside useFrame, never reaching
 * back into React state. This is what keeps node movement at 60fps.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  DEFAULT_FORCE_CONFIG,
  type ForceConfig,
  type MainToWorker,
  type WorkerToMain,
} from './workerProtocol';
import type { RenderEdge, RenderNode } from '../types';

export interface LayoutHandle {
  /** Mutable Float32Array of node positions: [x0, y0, x1, y1, ...]. */
  positions: Float32Array;
  /** Pin a node during drag (or null to unpin). */
  pin: (id: string, x: number | null, y: number | null) => void;
  /** Re-heat the simulation (after a structural change). */
  reheat: (alpha?: number) => void;
}

export function useLayout(
  nodes: RenderNode[],
  edges: RenderEdge[],
  config: ForceConfig = DEFAULT_FORCE_CONFIG,
): LayoutHandle {
  // Persistent position buffer — sized to the current node count.
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const workerRef = useRef<Worker | null>(null);
  const idToIndexRef = useRef<Map<string, number>>(new Map());
  const settledRef = useRef<boolean>(false);

  // Resize and seed positions when the node set changes.
  useEffect(() => {
    if (nodes.length === 0) {
      positionsRef.current = new Float32Array(0);
      idToIndexRef.current = new Map();
      return;
    }
    // Preserve existing positions for nodes that survived a structural change.
    const next = new Float32Array(nodes.length * 2);
    const prevIndex = idToIndexRef.current;
    const prev = positionsRef.current;
    const nextIndex = new Map<string, number>();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      nextIndex.set(n.id, i);
      const prevI = prevIndex.get(n.id);
      if (prevI != null && prev.length > prevI * 2 + 1) {
        next[i * 2] = prev[prevI * 2] ?? n.x;
        next[i * 2 + 1] = prev[prevI * 2 + 1] ?? n.y;
      } else {
        next[i * 2] = n.x;
        next[i * 2 + 1] = n.y;
      }
    }
    positionsRef.current = next;
    idToIndexRef.current = nextIndex;
  }, [nodes]);

  useEffect(() => {
    // Boot the worker on first mount. Using `new URL(...)` so Next.js's
    // webpack/turbopack picks it up at build time and emits a chunk.
    const worker = new Worker(new URL('./forceWorker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.addEventListener('message', (e: MessageEvent<WorkerToMain>) => {
      const msg = e.data;
      if (msg.type === 'tick') {
        // Adopt the new buffer in place — same length as our existing one
        // (or worker is out of sync, in which case we ignore).
        const incoming = new Float32Array(msg.positions);
        if (incoming.length === positionsRef.current.length) {
          positionsRef.current.set(incoming);
          settledRef.current = false;
        }
      } else if (msg.type === 'settled') {
        settledRef.current = true;
      }
    });

    return () => {
      const w = workerRef.current;
      if (w) {
        const dispose: MainToWorker = { type: 'dispose' };
        w.postMessage(dispose);
        w.terminate();
      }
      workerRef.current = null;
    };
  }, []);

  // Push topology updates to the worker whenever the structural shape
  // changes. We send a copy of the buffer (not a transfer) to keep ours.
  useEffect(() => {
    const w = workerRef.current;
    if (!w || nodes.length === 0) return;
    const copy = new Float32Array(positionsRef.current);
    const init: MainToWorker = {
      type: 'init',
      nodeIds: nodes.map((n) => n.id),
      initialPositions: copy.buffer,
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        strength: e.strength,
      })),
      config,
    };
    w.postMessage(init, [copy.buffer]);
  }, [nodes, edges, config]);

  // Stable callbacks — same identity across renders so downstream effects
  // that depend on the LayoutHandle don't fire spuriously.
  const pin = useCallback((id: string, x: number | null, y: number | null) => {
    const msg: MainToWorker = { type: 'pin', id, x, y };
    workerRef.current?.postMessage(msg);
  }, []);

  const reheat = useCallback((alpha = 0.5) => {
    const msg: MainToWorker = { type: 'reheat', alpha };
    workerRef.current?.postMessage(msg);
  }, []);

  // The `positions` buffer's identity can change on resize. We capture
  // its current value in the memo and return a stable object so the
  // handle's identity only changes when the buffer reallocates.
  const positions = positionsRef.current;
  return useMemo<LayoutHandle>(
    () => ({ positions, pin, reheat }),
    [positions, pin, reheat],
  );
}
