/**
 * Atlas CRDT layer — Yjs doc + IndexedDB persistence + typed accessors.
 *
 * Design choice: the Yjs document is the source of truth for the graph.
 * React/Zustand subscribe to its updates and project it into renderable
 * state, but they never own it. This makes realtime collab and
 * offline-first essentially free, and keeps mutation semantics one-way.
 *
 * Storage shape:
 *   doc.getMap('nodes') : Y.Map<string, Y.Map<keyof AtlasNode, any>>
 *   doc.getMap('edges') : Y.Map<string, Y.Map<keyof AtlasEdge, any>>
 *
 * We deliberately use Y.Map for each entity (rather than a single JSON
 * blob) so that field-level merges work cleanly under concurrent edits.
 */
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { AtlasNode, AtlasEdge } from '@atlas/types';

export const ATLAS_DOC_NAME = 'atlas:graph:v1';

export type GraphCollections = {
  doc: Y.Doc;
  nodes: Y.Map<Y.Map<unknown>>;
  edges: Y.Map<Y.Map<unknown>>;
  /** Awaits initial IndexedDB load (resolves whether or not data existed). */
  whenLoaded: Promise<void>;
  /** Returns true if IndexedDB had any persisted state. */
  hadPersistedState: () => boolean;
  destroy: () => void;
};

/**
 * Create or attach to the local Atlas doc. Idempotent within a session via
 * the global cache below — multiple React mounts share one doc.
 */
const cache = new Map<string, GraphCollections>();

export function getGraphDoc(docName: string = ATLAS_DOC_NAME): GraphCollections {
  const existing = cache.get(docName);
  if (existing) return existing;

  const doc = new Y.Doc({ guid: docName });
  const nodes = doc.getMap<Y.Map<unknown>>('nodes');
  const edges = doc.getMap<Y.Map<unknown>>('edges');

  let persistence: IndexeddbPersistence | null = null;
  let hadState = false;
  const whenLoaded = new Promise<void>((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve();
      return;
    }
    persistence = new IndexeddbPersistence(docName, doc);
    persistence.once('synced', () => {
      hadState = nodes.size > 0;
      resolve();
    });
  });

  const collections: GraphCollections = {
    doc,
    nodes,
    edges,
    whenLoaded,
    hadPersistedState: () => hadState,
    destroy: () => {
      persistence?.destroy();
      doc.destroy();
      cache.delete(docName);
    },
  };
  cache.set(docName, collections);
  return collections;
}

/* ────────────────────────────────────────────────────────────────────────
 * Typed accessors
 *
 * Read: project Y.Map → plain object (cheap; called from snapshot hooks)
 * Write: encode plain object → Y.Map atomically within a transaction
 * ────────────────────────────────────────────────────────────────────────*/

export function readNode(yNode: Y.Map<unknown>): AtlasNode {
  return {
    id: yNode.get('id') as string,
    kind: yNode.get('kind') as AtlasNode['kind'],
    title: (yNode.get('title') as string) ?? '',
    body: (yNode.get('body') as string) ?? '',
    x: (yNode.get('x') as number) ?? 0,
    y: (yNode.get('y') as number) ?? 0,
    weight: (yNode.get('weight') as number) ?? 0.5,
    status: (yNode.get('status') as AtlasNode['status']) ?? 'active',
    tags: ((yNode.get('tags') as string[]) ?? []).slice(),
    projectId: (yNode.get('projectId') as string | null) ?? null,
    createdAt: (yNode.get('createdAt') as number) ?? 0,
    updatedAt: (yNode.get('updatedAt') as number) ?? 0,
  };
}

export function readEdge(yEdge: Y.Map<unknown>): AtlasEdge {
  return {
    id: yEdge.get('id') as string,
    source: yEdge.get('source') as string,
    target: yEdge.get('target') as string,
    kind: (yEdge.get('kind') as AtlasEdge['kind']) ?? 'link',
    strength: (yEdge.get('strength') as number) ?? 0.5,
    createdAt: (yEdge.get('createdAt') as number) ?? 0,
  };
}

/** Snapshot the entire graph as plain objects. O(n) — call from React hooks. */
export function snapshotGraph(c: GraphCollections): {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
} {
  const nodes: AtlasNode[] = [];
  c.nodes.forEach((y) => nodes.push(readNode(y)));
  const edges: AtlasEdge[] = [];
  c.edges.forEach((y) => edges.push(readEdge(y)));
  return { nodes, edges };
}

export function upsertNode(c: GraphCollections, node: AtlasNode): void {
  c.doc.transact(() => {
    let yNode = c.nodes.get(node.id);
    if (!yNode) {
      yNode = new Y.Map();
      c.nodes.set(node.id, yNode);
    }
    for (const [k, v] of Object.entries(node)) {
      yNode.set(k, v);
    }
  }, 'local');
}

export function upsertEdge(c: GraphCollections, edge: AtlasEdge): void {
  c.doc.transact(() => {
    let yEdge = c.edges.get(edge.id);
    if (!yEdge) {
      yEdge = new Y.Map();
      c.edges.set(edge.id, yEdge);
    }
    for (const [k, v] of Object.entries(edge)) {
      yEdge.set(k, v);
    }
  }, 'local');
}

export function patchNode(
  c: GraphCollections,
  id: string,
  patch: Partial<AtlasNode>,
): void {
  c.doc.transact(() => {
    const yNode = c.nodes.get(id);
    if (!yNode) return;
    for (const [k, v] of Object.entries(patch)) {
      yNode.set(k, v);
    }
    yNode.set('updatedAt', Date.now());
  }, 'local');
}

export function deleteNode(c: GraphCollections, id: string): void {
  c.doc.transact(() => {
    c.nodes.delete(id);
    // Sweep dangling edges
    const toDelete: string[] = [];
    c.edges.forEach((yEdge, edgeId) => {
      if (yEdge.get('source') === id || yEdge.get('target') === id) {
        toDelete.push(edgeId);
      }
    });
    toDelete.forEach((edgeId) => c.edges.delete(edgeId));
  }, 'local');
}

export function bulkSeed(
  c: GraphCollections,
  data: { nodes: AtlasNode[]; edges: AtlasEdge[] },
): void {
  c.doc.transact(() => {
    for (const n of data.nodes) upsertNode(c, n);
    for (const e of data.edges) upsertEdge(c, e);
  }, 'local');
}

/** Subscribe to any change in the graph collections. Returns disposer. */
export function observeGraph(c: GraphCollections, cb: () => void): () => void {
  const handler = () => cb();
  c.nodes.observeDeep(handler);
  c.edges.observeDeep(handler);
  return () => {
    c.nodes.unobserveDeep(handler);
    c.edges.unobserveDeep(handler);
  };
}

export type { AtlasNode, AtlasEdge } from '@atlas/types';

export {
  createRealtimeProvider,
  type RealtimeProvider,
  type RealtimeStatus,
  type AwarenessState,
} from './realtime';
