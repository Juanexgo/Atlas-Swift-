'use client';

/**
 * Bridges the Atlas Yjs doc to the realtime gateway when available.
 *
 * Behavior:
 *  - On mount, we ping the API's /health endpoint. If it responds within
 *    1.5s, we boot a WebSocket provider against /realtime/<docId>.
 *  - If the API is offline we silently skip — the app remains fully
 *    functional via IndexedDB only.
 *  - Status (idle | connecting | connected | disconnected | error) plus
 *    peer count are exposed as React state so the HUD can show a dot.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ATLAS_DOC_NAME,
  createRealtimeProvider,
  getGraphDoc,
  type RealtimeProvider,
  type RealtimeStatus,
} from '@atlas/crdt';

const DEFAULT_API_URL =
  process.env.NEXT_PUBLIC_ATLAS_API_URL ?? 'http://localhost:4001';

const HEALTH_TIMEOUT_MS = 1500;

function deriveWsUrl(apiUrl: string): string {
  try {
    const u = new URL(apiUrl);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = u.pathname.replace(/\/$/, '') + '/realtime';
    return u.toString();
  } catch {
    return 'ws://localhost:4001/realtime';
  }
}

async function probeApi(apiUrl: string): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function makeClientId(): string {
  // Browsers expose crypto.randomUUID in modern releases.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `c_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function useRealtime(): {
  status: RealtimeStatus;
  provider: RealtimeProvider | null;
} {
  const clientId = useMemo(makeClientId, []);
  const [status, setStatus] = useState<RealtimeStatus>({ state: 'idle', peers: 0 });
  const [provider, setProvider] = useState<RealtimeProvider | null>(null);

  useEffect(() => {
    let disposed = false;
    let prov: RealtimeProvider | null = null;
    let unsub: (() => void) | null = null;

    (async () => {
      const ok = await probeApi(DEFAULT_API_URL);
      if (disposed) return;
      if (!ok) {
        // API not reachable — stay offline. We don't attempt reconnection
        // here because we don't want to flap if the user is intentionally
        // running Atlas without a server.
        setStatus({ state: 'idle', peers: 0 });
        return;
      }
      const wsUrl = deriveWsUrl(DEFAULT_API_URL);
      const collections = getGraphDoc(ATLAS_DOC_NAME);
      prov = createRealtimeProvider({
        url: wsUrl,
        doc: collections.doc,
        docId: ATLAS_DOC_NAME,
        clientId,
      });
      unsub = prov.subscribe(setStatus);
      setProvider(prov);
    })();

    return () => {
      disposed = true;
      unsub?.();
      prov?.destroy();
      setProvider(null);
    };
  }, [clientId]);

  return { status, provider };
}
