/**
 * WebSocket provider for the Atlas Yjs doc.
 *
 * Speaks the same JSON envelope as the server gateway in
 * apps/api/src/modules/realtime — base64-encoded Y.encodeStateAsUpdate
 * for syncs, plain JSON for awareness/presence.
 *
 * Lifecycle:
 *   1. Connect → server pushes its current state as a `sync` envelope.
 *   2. We apply it to our local doc inside a `remote` transaction so
 *      the update doesn't echo back to ourselves.
 *   3. We subscribe to local doc updates; every change goes out as a
 *      `sync` envelope, encoded as base64 of the diff.
 *   4. Reconnection with exponential backoff, capped at 8s.
 *
 * Awareness is intentionally minimal: a small JSON record per client
 * (cursor world-coords + display name) keyed by random clientId.
 */
import * as Y from 'yjs';

const SYNC_ORIGIN = 'remote';

export interface AwarenessState {
  clientId: string;
  name?: string;
  color?: string;
  cursor?: { x: number; y: number };
  focusId?: string | null;
}

export interface RealtimeStatus {
  /** 'idle' before first connect attempt; 'connecting' / 'connected' / 'disconnected' / 'error' otherwise */
  state: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  peers: number;
  lastError?: string;
}

export interface RealtimeProvider {
  status: () => RealtimeStatus;
  subscribe: (cb: (status: RealtimeStatus) => void) => () => void;
  setAwareness: (state: Partial<AwarenessState>) => void;
  awarenessSnapshot: () => Map<string, AwarenessState>;
  subscribeAwareness: (cb: (map: Map<string, AwarenessState>) => void) => () => void;
  destroy: () => void;
}

interface ProviderOptions {
  /** Full ws URL, e.g. ws://localhost:4001/realtime */
  url: string;
  doc: Y.Doc;
  /** doc id — matches `ATLAS_DOC_NAME` */
  docId: string;
  /** Local clientId (for awareness). Caller-generated. */
  clientId: string;
}

/* ── wire envelopes (mirror api/realtime.gateway.ts) ─────────────────── */

type SyncMsg = { type: 'sync'; doc: string; update: string };
type SyncReqMsg = { type: 'sync-request'; doc: string; sv?: string };
type AwarenessMsg = {
  type: 'awareness';
  doc: string;
  clientId: string;
  state: AwarenessState | null;
};
type Envelope = SyncMsg | SyncReqMsg | AwarenessMsg;

function isEnvelope(x: unknown): x is Envelope {
  return !!x && typeof x === 'object' && 'type' in x && 'doc' in x;
}

/* ── base64 helpers (browser-safe; Buffer fallback for Node tests) ────── */

function bytesToB64(b: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(b).toString('base64');
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  // eslint-disable-next-line no-undef
  return btoa(s);
}

function b64ToBytes(s: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  // eslint-disable-next-line no-undef
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── provider ────────────────────────────────────────────────────────── */

export function createRealtimeProvider(opts: ProviderOptions): RealtimeProvider {
  const { doc, docId, clientId } = opts;

  let ws: WebSocket | null = null;
  let destroyed = false;
  let backoffMs = 500;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  let status: RealtimeStatus = { state: 'idle', peers: 0 };
  const statusListeners = new Set<(s: RealtimeStatus) => void>();

  const awareness = new Map<string, AwarenessState>();
  const awarenessListeners = new Set<(m: Map<string, AwarenessState>) => void>();
  let localAwareness: AwarenessState = { clientId };

  function setStatus(next: Partial<RealtimeStatus>) {
    status = { ...status, ...next };
    statusListeners.forEach((cb) => cb(status));
  }

  function emitAwareness() {
    awarenessListeners.forEach((cb) => cb(new Map(awareness)));
  }

  function send(envelope: Envelope) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(envelope));
  }

  function applyRemoteSync(b64: string) {
    try {
      const update = b64ToBytes(b64);
      Y.applyUpdate(doc, update, SYNC_ORIGIN);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[atlas:realtime] bad sync envelope', err);
    }
  }

  // Local doc updates → broadcast.
  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === SYNC_ORIGIN) return; // came from server, don't echo
    send({
      type: 'sync',
      doc: docId,
      update: bytesToB64(update),
    });
  };
  doc.on('update', onDocUpdate);

  function connect() {
    if (destroyed) return;
    setStatus({ state: 'connecting' });
    try {
      const u = new URL(opts.url);
      // Send docId as a query parameter — the Nest WsAdapter binds the
      // gateway at an exact path, so sub-paths get rejected.
      u.searchParams.set('doc', docId);
      ws = new WebSocket(u.toString());
    } catch (err) {
      setStatus({ state: 'error', lastError: (err as Error).message });
      scheduleReconnect();
      return;
    }

    ws.addEventListener('open', () => {
      backoffMs = 500;
      setStatus({ state: 'connected' });
      // Immediately push our state vector so the server can send us its delta.
      const sv = Y.encodeStateVector(doc);
      send({ type: 'sync-request', doc: docId, sv: bytesToB64(sv) });
      // Send our awareness so peers see us.
      send({
        type: 'awareness',
        doc: docId,
        clientId,
        state: localAwareness,
      });
    });

    ws.addEventListener('message', (ev: MessageEvent) => {
      const raw = typeof ev.data === 'string' ? ev.data : '';
      if (!raw) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      if (!isEnvelope(parsed)) return;
      if (parsed.doc !== docId) return;
      if (parsed.type === 'sync') {
        applyRemoteSync(parsed.update);
      } else if (parsed.type === 'awareness') {
        if (parsed.state == null) awareness.delete(parsed.clientId);
        else awareness.set(parsed.clientId, parsed.state);
        setStatus({ peers: awareness.size });
        emitAwareness();
      }
    });

    ws.addEventListener('close', () => {
      ws = null;
      if (destroyed) return;
      // Clear remote awareness — those peers may not be there when we reconnect.
      awareness.clear();
      emitAwareness();
      setStatus({ state: 'disconnected', peers: 0 });
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      setStatus({ state: 'error', lastError: 'connection error' });
      // Let `close` drive the reconnect — error fires before close on most browsers.
    });
  }

  function scheduleReconnect() {
    if (destroyed || reconnectTimer) return;
    const delay = backoffMs;
    backoffMs = Math.min(8000, backoffMs * 2);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  connect();

  return {
    status: () => status,
    subscribe: (cb) => {
      statusListeners.add(cb);
      cb(status);
      return () => statusListeners.delete(cb);
    },
    setAwareness: (patch) => {
      localAwareness = { ...localAwareness, ...patch, clientId };
      send({
        type: 'awareness',
        doc: docId,
        clientId,
        state: localAwareness,
      });
    },
    awarenessSnapshot: () => new Map(awareness),
    subscribeAwareness: (cb) => {
      awarenessListeners.add(cb);
      cb(new Map(awareness));
      return () => awarenessListeners.delete(cb);
    },
    destroy: () => {
      destroyed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      doc.off('update', onDocUpdate);
      if (ws) {
        try {
          ws.close();
        } catch {
          /* noop */
        }
        ws = null;
      }
      statusListeners.clear();
      awarenessListeners.clear();
    },
  };
}
