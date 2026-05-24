/**
 * Realtime WebSocket gateway — speaks the y-protocols binary protocol so
 * any Yjs client (browser, mobile) can connect without a custom client.
 *
 * Each socket subscribes to a doc id (path: /realtime/:doc). Updates from
 * any client are applied to the server doc and broadcast to all other
 * sockets for that doc. Awareness/presence is plain JSON in a separate
 * message frame.
 *
 * Wire format:
 *   { type: 'sync', update: base64 } // Y.encodeStateAsUpdate
 *   { type: 'awareness', state: any }
 *
 * We deliberately use JSON here (vs the y-websocket binary frames) so
 * the gateway is debuggable from the browser DevTools network panel.
 * For 1000+ concurrent clients we'd switch to the binary protocol.
 */
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import * as Y from 'yjs';
import { YDocStore } from './ydoc.store';

type AwarenessState = Record<string, unknown>;

interface SyncMessage {
  type: 'sync';
  doc: string;
  /** Base64-encoded Y.encodeStateAsUpdate */
  update: string;
}
interface SyncRequestMessage {
  type: 'sync-request';
  doc: string;
  /** Base64-encoded state vector */
  sv?: string;
}
interface AwarenessMessage {
  type: 'awareness';
  doc: string;
  clientId: string;
  state: AwarenessState | null;
}
type AnyMessage = SyncMessage | SyncRequestMessage | AwarenessMessage;

interface SocketMeta {
  docId: string;
  clientId: string;
}

@WebSocketGateway({ path: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('Realtime');
  @WebSocketServer() server!: WSServer;

  private readonly socketMeta = new WeakMap<WebSocket, SocketMeta>();
  private readonly byDoc = new Map<string, Set<WebSocket>>();
  private readonly awareness = new Map<string, Map<string, AwarenessState>>();

  constructor(private readonly store: YDocStore) {}

  async handleConnection(client: WebSocket, ...args: unknown[]): Promise<void> {
    const req = args[0] as { url?: string } | undefined;
    const url = req?.url ?? '/realtime';
    // Accept either ?doc=<id> on the query string OR a doc id as a path
    // suffix (`/realtime/<id>`). Default to the canonical Atlas doc id.
    let docId = 'atlas:graph:v1';
    const [path, query] = url.split('?');
    if (query) {
      const params = new URLSearchParams(query);
      const fromQuery = params.get('doc');
      if (fromQuery) docId = decodeURIComponent(fromQuery);
    } else if (path && path !== '/realtime' && path !== '/realtime/') {
      const tail = path.split('/').pop();
      if (tail) docId = decodeURIComponent(tail);
    }
    const clientId = Math.random().toString(36).slice(2, 12);
    this.socketMeta.set(client, { docId, clientId });
    if (!this.byDoc.has(docId)) this.byDoc.set(docId, new Set());
    this.byDoc.get(docId)!.add(client);

    // Send the full doc state immediately so the new client converges.
    const doc = await this.store.getOrCreate(docId);
    const state = Y.encodeStateAsUpdate(doc);
    client.send(
      JSON.stringify({
        type: 'sync',
        doc: docId,
        update: Buffer.from(state).toString('base64'),
      } satisfies SyncMessage),
    );

    // Also send current awareness snapshot.
    const awarenessForDoc = this.awareness.get(docId);
    if (awarenessForDoc) {
      for (const [otherId, state] of awarenessForDoc.entries()) {
        client.send(
          JSON.stringify({
            type: 'awareness',
            doc: docId,
            clientId: otherId,
            state,
          } satisfies AwarenessMessage),
        );
      }
    }

    this.logger.log(`Connected ${clientId} → ${docId} (peers=${this.byDoc.get(docId)?.size})`);
  }

  handleDisconnect(client: WebSocket): void {
    const meta = this.socketMeta.get(client);
    if (!meta) return;
    this.byDoc.get(meta.docId)?.delete(client);
    const awarenessForDoc = this.awareness.get(meta.docId);
    if (awarenessForDoc?.has(meta.clientId)) {
      awarenessForDoc.delete(meta.clientId);
      this.broadcastToDoc(meta.docId, client, {
        type: 'awareness',
        doc: meta.docId,
        clientId: meta.clientId,
        state: null,
      });
    }
    this.logger.log(`Disconnected ${meta.clientId}`);
  }

  @SubscribeMessage('message')
  async onMessage(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const msg = parseMessage(body);
    if (!msg) return;
    const meta = this.socketMeta.get(client);
    if (!meta) return;

    if (msg.type === 'sync') {
      const doc = await this.store.getOrCreate(msg.doc);
      try {
        Y.applyUpdate(doc, Buffer.from(msg.update, 'base64'), 'remote');
      } catch (err) {
        this.logger.warn(`Bad sync from ${meta.clientId}: ${(err as Error).message}`);
        return;
      }
      // Re-broadcast to peers as a fresh update.
      this.broadcastToDoc(msg.doc, client, msg);
    } else if (msg.type === 'sync-request') {
      const doc = await this.store.getOrCreate(msg.doc);
      const sv = msg.sv ? Buffer.from(msg.sv, 'base64') : undefined;
      const state = Y.encodeStateAsUpdate(doc, sv);
      client.send(
        JSON.stringify({
          type: 'sync',
          doc: msg.doc,
          update: Buffer.from(state).toString('base64'),
        } satisfies SyncMessage),
      );
    } else if (msg.type === 'awareness') {
      if (!this.awareness.has(msg.doc)) this.awareness.set(msg.doc, new Map());
      const m = this.awareness.get(msg.doc)!;
      if (msg.state == null) m.delete(msg.clientId);
      else m.set(msg.clientId, msg.state);
      this.broadcastToDoc(msg.doc, client, msg);
    }
  }

  private broadcastToDoc(docId: string, except: WebSocket, msg: AnyMessage): void {
    const sockets = this.byDoc.get(docId);
    if (!sockets) return;
    const data = JSON.stringify(msg);
    for (const s of sockets) {
      if (s === except) continue;
      if (s.readyState === WebSocket.OPEN) s.send(data);
    }
  }
}

function parseMessage(body: unknown): AnyMessage | null {
  let parsed: unknown = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
  } else if (Buffer.isBuffer(body)) {
    try {
      parsed = JSON.parse(body.toString('utf8'));
    } catch {
      return null;
    }
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('type' in parsed) ||
    !('doc' in parsed)
  )
    return null;
  return parsed as AnyMessage;
}
