'use client';

/**
 * Imperative actions on the Atlas graph that the palette + keybindings
 * call into. Centralized so multiple UI surfaces share the same write
 * path into Yjs.
 *
 * All writes go through @atlas/crdt — they replicate to IndexedDB and
 * (when the realtime gateway is connected) to all peers.
 */
import { useCallback } from 'react';
import {
  bulkSeed,
  getGraphDoc,
  upsertNode,
  upsertEdge,
} from '@atlas/crdt';
import {
  type NodeKind,
  makeId,
  type AtlasNode,
} from '@atlas/types';
import { graphStore } from '@atlas/graph-engine';
import { mapSmart } from '@/features/import/smartImport';

export interface ImportResult {
  ok: boolean;
  reason?: string;
  count?: number;
  edgeCount?: number;
  source?: 'canonical' | 'smart';
  warnings?: string[];
}

export interface AtlasActions {
  createNode: (kind: NodeKind, title: string, opts?: { x?: number; y?: number }) => string;
  deleteFocused: () => void;
  importFromClipboard: () => Promise<ImportResult>;
  importFromText: (text: string) => ImportResult;
  importFromFile: (file: File) => Promise<ImportResult>;
  resetAll: () => void;
}

export function useAtlasActions(): AtlasActions {
  const createNode = useCallback<AtlasActions['createNode']>(
    (kind, title, opts = {}) => {
      const doc = getGraphDoc();
      const cam = graphStore.getState().camera;
      // Spawn near the camera center with a small random offset so
      // successive creates don't stack.
      const jitter = () => (Math.random() - 0.5) * 60;
      const id = makeId('n');
      const now = Date.now();
      const node: AtlasNode = {
        id,
        kind,
        title: title.trim() || 'Untitled',
        body: '',
        x: opts.x ?? cam.x + jitter(),
        y: opts.y ?? cam.y + jitter(),
        weight: 0.5,
        status: 'active',
        tags: [],
        projectId: null,
        createdAt: now,
        updatedAt: now,
      };
      upsertNode(doc, node);
      // Focus the new node immediately for a satisfying "captured!" beat.
      setTimeout(() => graphStore.getState().setFocus(id), 30);
      return id;
    },
    [],
  );

  const deleteFocused = useCallback(() => {
    const id = graphStore.getState().focusId;
    if (!id) return;
    const doc = getGraphDoc();
    // Inline deleteNode equivalent — go through the crdt accessor.
    import('@atlas/crdt').then((m) => m.deleteNode(doc, id));
    graphStore.getState().setFocus(null);
  }, []);

  const importFromText = useCallback<AtlasActions['importFromText']>((text) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'Not valid JSON' };
    }
    const result = mapSmart(parsed);
    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }
    const doc = getGraphDoc();
    bulkSeed(doc, result.snapshot);
    return {
      ok: true,
      count: result.snapshot.nodes.length,
      edgeCount: result.snapshot.edges.length,
      source: result.source,
      warnings: result.warnings,
    };
  }, []);

  const importFromClipboard = useCallback<AtlasActions['importFromClipboard']>(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return { ok: false, reason: 'Clipboard API unavailable' };
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return { ok: false, reason: 'Clipboard is empty' };
      return importFromText(text);
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }, [importFromText]);

  const importFromFile = useCallback<AtlasActions['importFromFile']>(
    async (file) => {
      if (!file.name.toLowerCase().endsWith('.json') && !file.type.includes('json')) {
        return { ok: false, reason: 'Only .json files are supported (got ' + (file.type || 'unknown') + ')' };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { ok: false, reason: 'File is over 50MB — please split it.' };
      }
      try {
        const text = await file.text();
        return importFromText(text);
      } catch (e) {
        return { ok: false, reason: (e as Error).message };
      }
    },
    [importFromText],
  );

  const resetAll = useCallback(() => {
    const ok = typeof window !== 'undefined' && window.confirm('Clear all nodes and edges? This cannot be undone.');
    if (!ok) return;
    const doc = getGraphDoc();
    doc.doc.transact(() => {
      doc.nodes.clear();
      doc.edges.clear();
    }, 'local');
  }, []);

  // Keep upsertEdge in scope — exported for future per-edge actions.
  void upsertEdge;

  return {
    createNode,
    deleteFocused,
    importFromClipboard,
    importFromText,
    importFromFile,
    resetAll,
  };
}
