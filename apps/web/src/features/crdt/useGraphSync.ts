'use client';

/**
 * Bridge between the Yjs document and the engine's render store.
 *
 * On mount:
 *   1. Open the Atlas Yjs doc + IndexedDB persistence (idempotent).
 *   2. Wait for the persisted state to load.
 *   3. If empty, seed the document.
 *   4. Subscribe to deep changes — on any update, snapshot and push to
 *      the engine store. The store handles the cheap projection.
 *
 * This hook is the *only* place that touches Yjs from the UI tree.
 * Mutations go through the typed CRDT accessors elsewhere.
 */
import { useEffect, useState } from 'react';
import { bulkSeed, getGraphDoc, observeGraph, snapshotGraph } from '@atlas/crdt';
import { graphStore } from '@atlas/graph-engine';
import { generateSeedGraph } from '@/features/seed/seedGraph';

type Status = 'loading' | 'ready';

export function useGraphSync(): { status: Status } {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let disposed = false;
    let unsub: (() => void) | null = null;

    (async () => {
      const doc = getGraphDoc();
      await doc.whenLoaded;
      if (disposed) return;

      if (!doc.hadPersistedState()) {
        // Seed once on first run.
        const seed = generateSeedGraph();
        bulkSeed(doc, seed);
      }

      // Initial snapshot + subscription.
      const push = () => {
        graphStore.getState().setGraph(snapshotGraph(doc));
      };
      push();
      unsub = observeGraph(doc, push);
      setStatus('ready');
    })();

    return () => {
      disposed = true;
      unsub?.();
    };
  }, []);

  return { status };
}
